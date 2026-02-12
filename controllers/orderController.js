const fs = require('fs');
const csv = require('csv-parser');
const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const ReportLog = require('../models/ReportLog');
const User = require('../models/User');
const Product = require('../models/Product');

// @desc    Bulk import orders from CSVfdfdddf
// @route   POST /api/orders/bulk-importt
// @access  Private (Admin/Super Admin)
const bulkImportOrders = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('Please upload a CSV file');
    }

    const results = [];
    const errors = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            // Remove the temp file
            fs.unlinkSync(req.file.path);

            // Group rows by Order Name first (to handle multi-line orders)
            const ordersMap = new Map();

            for (const row of results) {
                const orderId = row['Order Name'];
                if (!orderId) {
                    errors.push({ order: 'Unknown', error: 'Missing Order Name' });
                    continue;
                }
                if (!ordersMap.has(orderId)) {
                    ordersMap.set(orderId, []);
                }
                ordersMap.get(orderId).push(row);
            }

            let successCount = 0;

            for (const [orderId, rows] of ordersMap) {
                try {
                    // Use the first row for common order details
                    const firstRow = rows[0];

                    const phone1 = firstRow['Shipping Address Phone'];
                    const phone2 = firstRow['Billing Phone'];
                    const customerName = firstRow['Customer Name (Shipping)'];
                    const address = firstRow['Shipping Address 1'];
                    const city = firstRow['Shipping City'];
                    const country = firstRow['Shipping Country'] || 'Sri Lanka';
                    const email = firstRow['Email'];
                    const createdAtRaw = firstRow['Order Created Date'];
                    const paymentMethodRaw = firstRow['Payment Gateway Names'];
                    const source = firstRow['Transaction Payment ID'];
                    const subtotalCsv = Number(firstRow['Sum of Total Line Item Price (Total Net)']);

                    if (!customerName || !phone1) {
                        errors.push({ order: orderId, error: 'Missing customer Name or Phone' });
                        continue;
                    }

                    // 1. Handle Customer
                    let customer = await Customer.findOne({ phone: phone1 });
                    if (!customer) {
                        customer = await Customer.create({
                            name: customerName,
                            phone: phone1,
                            phone2: phone2,
                            address: address || 'N/A',
                            city: city,
                            country: country,
                            email: email
                        });
                    }

                    // 2. Handle Agent
                    let agent = await User.findOne({ name: 'Web Orders', role: 'Agent' });
                    if (!agent) {
                        try {
                            const bcrypt = require('bcryptjs');
                            const salt = await bcrypt.genSalt(10);
                            const hashedPassword = await bcrypt.hash('123456', salt);

                            agent = await User.create({
                                name: 'Web Orders',
                                email: 'weborders@oms.local',
                                password: hashedPassword,
                                role: 'Agent',
                                phone: '0000000000',
                                address: 'System'
                            });
                        } catch (err) {
                            console.error("Failed to create Web Orders agent:", err);
                            agent = req.user; // Fallback to current admin
                        }
                    }

                    // 3. Handle Payment Status
                    let paymentStatus = 'COD';
                    if (paymentMethodRaw) {
                        const lowerPay = paymentMethodRaw.toLowerCase();
                        if (lowerPay.includes('paid') || lowerPay.includes('card') || lowerPay.includes('visa') || lowerPay.includes('payhere')) {
                            paymentStatus = 'Paid';
                        }
                    }

                    // 4. Handle Items
                    const items = [];
                    let calculatedTotal = 0;

                    for (const itemRow of rows) {
                        const productName = itemRow['Line Item Name (Product Title + Options)'];
                        const price = Number(itemRow['Product Price (Line Item Price)']) || 0;
                        const quantity = Number(itemRow['Fulfillable Quantity']) || 1;

                        if (!productName) continue;

                        let product = await Product.findOne({ name: productName });
                        if (!product) {
                            product = await Product.create({
                                name: productName,
                                price: price,
                                description: 'Imported',
                                weight: 0
                            });
                        }

                        items.push({
                            product: product._id,
                            productName: productName,
                            quantity: quantity,
                            price: price
                        });

                        calculatedTotal += price * quantity;
                    }

                    if (items.length === 0) {
                        errors.push({ order: orderId, error: 'No valid items found' });
                        continue;
                    }

                    // 5. Totals & Delivery Logic
                    // Use calculated total from items, but check if CSV subtotal matches or differs (e.g. discount)
                    let totalAmount = calculatedTotal;
                    if (!isNaN(subtotalCsv) && subtotalCsv > 0) {
                        totalAmount = subtotalCsv;
                    }

                    let deliveryCharge = 0;
                    // Standard logic: if total < 2500, charge 350
                    // EXCEPTION: if order contains "moist curl", delivery is free
                    const hasFreeDeliveryItem = items.some(item =>
                        item.productName && item.productName.toLowerCase().includes("moist curl")
                    );

                    if (!hasFreeDeliveryItem && totalAmount < 2500) {
                        deliveryCharge = 350;
                    }

                    const finalAmount = totalAmount + deliveryCharge;

                    // 6. Create Order
                    const order = new Order({
                        customer: customer._id,
                        items,
                        totalAmount: totalAmount,
                        discountAmount: 0,
                        deliveryCharge,
                        finalAmount,
                        paymentStatus,
                        agent: agent._id,
                        status: 'Pending',
                        remark: orderId, // Use Order Name as remark
                        additionalRemark: createdAtRaw || '',
                        createdAt: new Date() // Import date as current for dashboard visibility
                    });

                    const createdOrder = await order.save();

                    // Add to customer history
                    customer.orderHistory.push(createdOrder._id);
                    await customer.save();

                    successCount++;
                } catch (err) {
                    errors.push({ order: orderId, error: err.message });
                }
            }

            res.json({
                message: 'Import processed',
                successCount,
                errorCount: errors.length,
                errors
            });
        });
});



// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
    const {
        customerId,
        items,
        totalAmount,
        discountAmount,
        finalAmount,
        paymentStatus,
        remark,
        additionalRemark,
        deliveryCharge: manualDeliveryCharge // Extract deliveryCharge if provided
    } = req.body;

    if (!items || items.length === 0) {
        res.status(400);
        throw new Error('No order items');
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Calculate totals
    let calculatedTotal = 0;
    for (const item of items) {
        calculatedTotal += Number(item.price) * Number(item.quantity);
    }

    // Delivery Charge Logic: >= 2500 is FREE, otherwise 350
    // EXCEPTION: Single item "moist curl" is FREE delivery
    // ALLOW OVERRIDE: If manualDeliveryCharge is provided, use it.
    let deliveryCharge = 0;

    if (manualDeliveryCharge !== undefined && manualDeliveryCharge !== null) {
        deliveryCharge = Number(manualDeliveryCharge);
    } else {
        // Check for special condition: "moist curl" is FREE delivery
        const hasFreeDeliveryItem = items.some(item =>
            item.productName && item.productName.toLowerCase().includes("moist curl")
        );

        if (!hasFreeDeliveryItem && calculatedTotal < 2500) {
            deliveryCharge = 350;
        }
    }

    const calculatedFinal = calculatedTotal - Number(discountAmount || 0) + deliveryCharge;

    // Auto-append discount info to remark if discount applied
    let finalRemark = remark || '';
    if (discountAmount > 0) {
        const discountInfo = `Discount Applied: Rs. ${discountAmount}`;
        if (finalRemark) {
            finalRemark = `${finalRemark} | ${discountInfo}`;
        } else {
            finalRemark = discountInfo;
        }
    }

    const order = new Order({
        customer: customerId,
        items,
        totalAmount: calculatedTotal,
        discountAmount,
        deliveryCharge,
        finalAmount: calculatedFinal,
        paymentStatus,
        agent: req.user._id,
        status: 'Pending',
        remark: finalRemark,
        additionalRemark
    });

    const createdOrder = await order.save();

    // Add to customer history
    customer.orderHistory.push(createdOrder._id);
    await customer.save();

    res.status(201).json(createdOrder);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
const getOrders = asyncHandler(async (req, res) => {
    let query = {};
    const { startDate, endDate } = req.query;

    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const orders = await Order.find(query)
        .populate('customer', 'name phone phone2 address city country email')
        .populate('agent', 'name')
        .populate('editRequest.from', 'name')
        .populate('editedBy.agent', 'name')
        .sort({ createdAt: -1 });

    res.json(orders);
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('customer', 'name phone phone2 email address city country')
        .populate('agent', 'name email')
        .populate('editedBy.agent', 'name');

    if (order) {
        res.json(order);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
const updateOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Check permissions
    const isAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin';
    const isOwner = order.agent.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
        res.status(403);
        throw new Error('Not authorized to edit this order.');
    }

    const {
        customerId,
        items,
        discountAmount,
        paymentStatus,
        remark,
        additionalRemark,
        deliveryCharge: manualDeliveryCharge,
        status
    } = req.body;

    // Recalculate if items or discount or delivery charge is provided
    if (items || discountAmount !== undefined || manualDeliveryCharge !== undefined || remark !== undefined) {
        let calculatedTotal = order.totalAmount;
        let finalItems = order.items;

        if (items) {
            calculatedTotal = 0;
            for (const item of items) {
                calculatedTotal += Number(item.price) * Number(item.quantity);
            }
            finalItems = items;
        }

        const finalDiscount = discountAmount !== undefined ? Number(discountAmount) : order.discountAmount;

        let deliveryCharge = order.deliveryCharge;
        if (manualDeliveryCharge !== undefined && manualDeliveryCharge !== null) {
            deliveryCharge = Number(manualDeliveryCharge);
        } else if (items) {
            // Recalculate delivery if items changed and no manual override in this request
            const hasFreeDeliveryItem = items.some(item =>
                item.productName && item.productName.toLowerCase().includes("moist curl")
            );
            if (hasFreeDeliveryItem) {
                deliveryCharge = 0;
            } else {
                deliveryCharge = (calculatedTotal < 2500 && calculatedTotal > 0) ? 350 : 0;
            }
        }

        const calculatedFinal = calculatedTotal - finalDiscount + deliveryCharge;

        // Clean existing "Discount Applied" from remark to avoid duplication
        let finalRemark = (remark !== undefined ? remark : order.remark) || '';
        finalRemark = finalRemark.split(' | Discount Applied:')[0].replace(/Discount Applied: Rs\. \d+(\.\d+)?/g, '').trim();

        if (finalDiscount > 0) {
            const discountInfo = `Discount Applied: Rs. ${finalDiscount}`;
            if (finalRemark) {
                finalRemark = `${finalRemark} | ${discountInfo}`;
            } else {
                finalRemark = discountInfo;
            }
        }

        order.totalAmount = calculatedTotal;
        order.items = finalItems;
        order.discountAmount = finalDiscount;
        order.deliveryCharge = deliveryCharge;
        order.finalAmount = calculatedFinal;
        order.remark = finalRemark;
    }

    if (customerId) order.customer = customerId;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (additionalRemark !== undefined) order.additionalRemark = additionalRemark;
    if (isAdmin && status) order.status = status;

    // Resolve any pending request
    order.editRequest.pending = false;

    // Log the edit
    order.editedBy.push({ agent: req.user._id, at: new Date() });

    const updatedOrder = await order.save();
    res.json(updatedOrder);
});

// @desc    Request edit for an order
// @route   POST /api/orders/:id/request-edit
// @access  Private
const requestEditOrder = asyncHandler(async (req, res) => {
    const { message } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (!message) {
        res.status(400);
        throw new Error('Message is required');
    }

    order.editRequest = {
        pending: true,
        message,
        from: req.user._id,
        createdAt: new Date()
    };

    await order.save();
    res.json({ message: 'Edit request sent', order });
});

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private (Super Admin Only + Password)
const deleteOrder = asyncHandler(async (req, res) => {
    const { password } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (req.user.role !== 'Super Admin' && req.user.role !== 'Admin') {
        res.status(403);
        throw new Error('Not authorized. Only Admin or Super Admin can delete orders.');
    }

    if (!password) {
        res.status(400);
        throw new Error('Password is required for deletion');
    }

    const bcrypt = require('bcryptjs');
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid password. Deletion denied.');
    }

    await order.deleteOne();
    res.json({ message: 'Order removed' });
});

// @desc    Delete all orders
// @route   DELETE /api/orders/bulk-delete
// @access  Private (Super Admin Only + Password)
const bulkDeleteOrders = asyncHandler(async (req, res) => {
    const { password } = req.body;

    if (req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Only Super Admin can perform bulk deletion.');
    }

    if (!password) {
        res.status(400);
        throw new Error('Password is required for bulk deletion');
    }

    const bcrypt = require('bcryptjs');
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid password. Bulk deletion denied.');
    }

    const result = await Order.deleteMany({});
    res.json({ message: `Successfully deleted ${result.deletedCount} orders` });
});

// @desc    Get dashboard stats
// @route   GET /api/orders/stats
// @access  Private
const getDashboardStats = asyncHandler(async (req, res) => {
    const totalOrders = await Order.countDocuments();

    // Aggregation for Total Revenue (All Time)
    const revenueAgg = await Order.aggregate([
        { $group: { _id: null, total: { $sum: "$finalAmount" } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    // Aggregation for Today's Revenue
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaysRevenueAgg = await Order.aggregate([
        { $match: { createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: "$finalAmount" } } }
    ]);
    const todaysRevenue = todaysRevenueAgg.length > 0 ? todaysRevenueAgg[0].total : 0;

    const totalCustomers = await Customer.countDocuments();

    res.json({
        totalOrders,
        totalRevenue,
        todaysRevenue,
        totalCustomers
    });
});



// @desc    Bulk update order status
// @route   PUT /api/orders/bulk-status
// @access  Private (Admin/Super Admin)
const bulkUpdateStatus = asyncHandler(async (req, res) => {
    const { startDate, endDate, status } = req.body;

    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Admin or Super Admin only.');
    }

    if (!startDate || !endDate || !status) {
        res.status(400);
        throw new Error('Please provide startDate, endDate, and status');
    }

    // Adjust endDate to include the full day if it's just a date string, 
    // or assume the client sends full ISO strings.
    // If client sends "2023-01-01", we might want to ensure it covers the whole day.
    // For now, assuming client sends accurate range or we query simply:

    // Find orders in range
    const filter = {
        createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    };

    const result = await Order.updateMany(filter, {
        $set: { status: status },
        $push: { editedBy: { agent: req.user._id, at: new Date() } }
    });

    res.json({ message: `Updated ${result.modifiedCount} orders to ${status}` });
});

// @desc    Export orders (mark as downloaded)
// @route   PUT /api/orders/export
// @access  Private
const exportOrders = asyncHandler(async (req, res) => {
    const { startDate, endDate, paymentStatus, agentId } = req.body;

    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Only Admins can export (dispatch) orders.');
    }

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Please provide startDate and endDate');
    }

    const filter = {
        createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    };

    if (paymentStatus && paymentStatus !== 'All') {
        filter.paymentStatus = paymentStatus;
    }

    if (agentId && agentId !== 'All') {
        filter.agent = agentId;
    }

    // First fetch the orders to return them
    const orders = await Order.find(filter)
        .populate('customer', 'name phone phone2 address city country email')
        .populate('agent', 'name')
        .sort({ createdAt: -1 });

    const isDispatch = !agentId || agentId === 'All';

    // Then update them ONLY IF it's a dispatch (All Agents)
    if (isDispatch && orders.length > 0) {
        const orderIds = orders.map(o => o._id);
        await Order.updateMany(
            { _id: { $in: orderIds } },
            {
                $set: {
                    isDownloaded: true,
                    status: 'Dispatched'
                }
            }
        );
        console.log(`Export & Dispatch: Marked ${orders.length} orders as downloaded/dispatched.`);
    } else {
        console.log(`Export Report: Downloaded ${orders.length} orders for agent ${agentId}. Records NOT modified.`);
    }

    // Log the export
    await ReportLog.create({
        generatedBy: req.user._id,
        startDate,
        endDate,
        orderCount: orders.length,
        status: 'Success',
        paymentStatus: paymentStatus || 'All',
        agentId: (agentId && agentId !== 'All') ? agentId : null,
        isDispatch
    });

    res.json(orders);
});

// @desc    Get export history
// @route   GET /api/orders/export-history
// @access  Private
const getExportHistory = asyncHandler(async (req, res) => {
    const logs = await ReportLog.find({})
        .populate('generatedBy', 'name email')
        .sort({ generatedAt: -1 });
    res.json(logs);
});

// @desc    Get logged-in agent's report (Read Only)
// @route   GET /api/orders/my-report
// @access  Private (Agent)
const getMyReport = asyncHandler(async (req, res) => {
    const { startDate, endDate, paymentStatus } = req.query;

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Please provide startDate and endDate');
    }

    const filter = {
        agent: req.user._id, // Enforce current user
        createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    };

    if (paymentStatus && paymentStatus !== 'All') {
        filter.paymentStatus = paymentStatus;
    }

    const orders = await Order.find(filter)
        .populate('customer', 'name phone phone2 address city country email')
        .populate('agent', 'name')
        .sort({ createdAt: -1 });

    res.json(orders);
});

// @desc    Get count of pending edit requests for the logged-in agent
// @route   GET /api/orders/pending-edits-count
// @access  Private
const getPendingEditRequestsCount = asyncHandler(async (req, res) => {
    const mongoose = require('mongoose');
    try {
        const userId = new mongoose.Types.ObjectId(req.user._id);
        const count = await Order.countDocuments({
            agent: userId,
            'editRequest.pending': true
        });

        console.log("Checking pending edits for user:", req.user._id);
        console.log("Found pending edits count:", count);
        res.json({
            count,
            debug: {
                user: req.user._id,
                type: typeof req.user._id,
                casted: userId
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// @desc    Get agent-wise and product-wise order counts for today
// @route   GET /api/orders/matrix
// @access  Private
const getOrderMatrix = asyncHandler(async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const matrixData = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            }
        },
        { $unwind: "$items" },
        {
            $group: {
                _id: {
                    agent: "$agent",
                    product: "$items.productName"
                },
                count: { $sum: 1 } // Number of orders containing this product
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id.agent",
                foreignField: "_id",
                as: "agentInfo"
            }
        },
        { $unwind: { path: "$agentInfo", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                agentName: { $ifNull: ["$agentInfo.name", "Unknown"] },
                productName: "$_id.product",
                count: 1
            }
        }
    ]);

    // Format for frontend matrix
    const agentSet = new Set();
    const productSet = new Set();
    const dataMap = {};

    matrixData.forEach(item => {
        agentSet.add(item.agentName);
        productSet.add(item.productName);
        if (!dataMap[item.agentName]) dataMap[item.agentName] = {};
        dataMap[item.agentName][item.productName] = (dataMap[item.agentName][item.productName] || 0) + item.count;
    });

    res.json({
        agents: Array.from(agentSet).sort(),
        products: Array.from(productSet).sort(),
        data: dataMap
    });
});

module.exports = {
    createOrder,
    getOrders,
    getOrderById,
    updateOrder,
    deleteOrder,
    bulkDeleteOrders,
    getDashboardStats,
    bulkUpdateStatus,
    exportOrders,
    getExportHistory,
    getMyReport,
    bulkImportOrders,
    requestEditOrder,
    getPendingEditRequestsCount,
    getOrderMatrix
};
