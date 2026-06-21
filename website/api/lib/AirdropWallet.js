const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    walletAddress: { type: String, required: true, unique: true, index: true },
    completedTasks: { type: [String], default: [] },
    earnedTon: { type: Number, default: 0 },
    claimed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.AirdropWallet || mongoose.model('AirdropWallet', schema);
