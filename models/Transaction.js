const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    chatId: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: ['deposit', 'pack_purchase', 'card_sell', 'withdraw_request', 'referral', 'game_reward', 'burn', 'task_reward', 'free_pack'],
        required: true
    },
    amount: { type: Number, default: 0 },
    status: { type: String, default: 'completed' },
    txHash: { type: String, default: '', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
