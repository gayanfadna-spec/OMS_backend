const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true }, // Contact 1
    phone2: { type: String }, // Contact 2
    address: { type: String, required: true },
    city: { type: String },
    country: { type: String, default: 'Sri Lanka' },
    email: { type: String }, // Optional
    orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }]
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
