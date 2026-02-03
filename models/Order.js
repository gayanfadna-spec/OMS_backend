const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        productName: { type: String, required: true }, // Store name in case product is deleted
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    remark: { type: String }, // Optional remark field
    additionalRemark: { type: String }, // Second optional remark field
    status: {
        type: String,
        enum: ['Pending', 'Dispatched', 'Returned'],
        default: 'Pending'
    },
    paymentStatus: {
        type: String,
        enum: ['COD', 'Paid', 'Export'],
        default: 'COD'
    },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The agent who created it
    editedBy: [{
        agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now }
    }],
    editRequest: {
        pending: { type: Boolean, default: false },
        message: { type: String },
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date }
    },
    isDownloaded: { type: Boolean, default: false } // Track if order was exported
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
