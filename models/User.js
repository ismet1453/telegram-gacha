const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    uid: { type: String, required: true },
    tierId: Number,
    tierName: String,
    player: String,
    nation: String,
    number: Number,
    primary: String,
    secondary: String,
    value: Number,
    burnReward: Number
}, { _id: false });

const userSchema = new mongoose.Schema({
    chatId: { type: String, required: true, unique: true, index: true },
    username: String,
    firstName: String,
    walletAddress: { type: String, default: '' },
    virtualBalance: { type: Number, default: 0 },
    cupCoins: { type: Number, default: 0 },
    inventory: { type: [cardSchema], default: [] },
    gamePoints: { type: Number, default: 0 },
    dailyGamesPlayed: { type: Number, default: 0 },
    lastGameDate: { type: String, default: '' },
    lastLoginDate: { type: String, default: '' },
    dailyFreePackClaimed: { type: Boolean, default: false },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: String, default: '' },
    pityCounters: {
        BRONZE: { type: Number, default: 0 },
        SILVER: { type: Number, default: 0 },
        GOLD: { type: Number, default: 0 },
        DIAMOND: { type: Number, default: 0 }
    },
    completedTasks: { type: [String], default: [] }
}, { timestamps: true });

userSchema.pre('save', function ensureReferralCode(next) {
    if (!this.referralCode) {
        this.referralCode = `ref_${this.chatId}`;
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
