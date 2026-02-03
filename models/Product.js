const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    weight: { type: Number, required: true },
    unit: { type: String, enum: ['g', 'ml', 'capsules'], default: 'g' },
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
