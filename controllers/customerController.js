const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer');

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = asyncHandler(async (req, res) => {
    const { name, phone, phone2, address, city, email } = req.body;

    if (!name || !phone || !address) {
        res.status(400);
        throw new Error('Please add all required fields');
    }

    const customerExists = await Customer.findOne({ phone });

    if (customerExists) {
        res.status(400);
        throw new Error('Customer with this phone already exists');
    }

    const customer = await Customer.create({
        name,
        phone,
        phone2,
        address,
        city,
        email
    });

    res.status(201).json(customer);
});

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = asyncHandler(async (req, res) => {
    const customers = await Customer.find({});
    res.json(customers);
});

// @desc    Get customer by phone
// @route   GET /api/customers/lookup/:phone
// @access  Private
const getCustomerByPhone = asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ phone: req.params.phone }).populate({
        path: 'orderHistory',
        options: { sort: { createdAt: -1 } }
    });

    if (customer) {
        res.json(customer);
    } else {
        res.status(404);
        throw new Error('Customer not found');
    }
});

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = asyncHandler(async (req, res) => {
    const { name, phone, phone2, address, city, email } = req.body;
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Check if phone is being updated and if it's already taken
    if (phone && phone !== customer.phone) {
        const phoneExists = await Customer.findOne({ phone });
        if (phoneExists) {
            res.status(400);
            throw new Error('Another customer already has this phone number');
        }
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
    });

    res.json(updatedCustomer);
});

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Super Admin Only + Password)
const deleteCustomer = asyncHandler(async (req, res) => {
    const { password } = req.body;
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    if (req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Only Super Admin can delete customers.');
    }

    if (!password) {
        res.status(400);
        throw new Error('Password is required for deletion');
    }

    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid password. Deletion denied.');
    }

    await customer.deleteOne();
    res.json({ message: 'Customer removed' });
});

// @desc    Delete all customers
// @route   DELETE /api/customers/bulk-delete
// @access  Private (Super Admin Only + Password)
const bulkDeleteCustomers = asyncHandler(async (req, res) => {
    const { password } = req.body;

    if (req.user.role !== 'Super Admin') {
        res.status(403);
        throw new Error('Not authorized. Only Super Admin can perform bulk deletion.');
    }

    if (!password) {
        res.status(400);
        throw new Error('Password is required for bulk deletion');
    }

    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid password. Bulk deletion denied.');
    }

    const result = await Customer.deleteMany({});
    res.json({ message: `Successfully deleted ${result.deletedCount} customers` });
});

module.exports = {
    createCustomer,
    getCustomers,
    getCustomerByPhone,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers
};
