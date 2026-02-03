const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true },
    minOrderValue: { type: Number, default: 0 },
    appliesTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], // Empty means all
    isActive: { type: Boolean, default: true },
    expiryDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Discount', discountSchema);
