const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    chatId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
    walletAddress: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    adminNote: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
