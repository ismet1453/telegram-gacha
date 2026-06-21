const mongoose = require('mongoose');

const airdropWalletSchema = new mongoose.Schema({
    walletAddress: { type: String, required: true, unique: true, index: true },
    completedTasks: { type: [String], default: [] },
    earnedTon: { type: Number, default: 0 },
    claimed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('AirdropWallet', airdropWalletSchema);
