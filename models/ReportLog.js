const mongoose = require('mongoose');

const reportLogSchema = new mongoose.Schema({
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    orderCount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Success', 'Failed'],
        default: 'Success'
    },
    paymentStatus: {
        type: String,
        default: 'All'
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isDispatch: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: { createdAt: 'generatedAt', updatedAt: false }
});

module.exports = mongoose.model('ReportLog', reportLogSchema);
