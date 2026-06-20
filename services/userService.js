const User = require('../models/User');
const economy = require('../config/economy');

function todayKey() {
    return new Date().toISOString().split('T')[0];
}

async function getOrCreateUser(chatId, telegramProfile = {}) {
    let user = await User.findOne({ chatId: String(chatId) });

    if (!user) {
        user = await User.create({
            chatId: String(chatId),
            username: telegramProfile.username || '',
            firstName: telegramProfile.first_name || '',
            referralCode: `ref_${chatId}`
        });
    }

    const today = todayKey();

    if (user.lastGameDate !== today) {
        user.dailyGamesPlayed = 0;
        user.lastGameDate = today;
    }

    if (user.lastLoginDate !== today) {
        user.lastLoginDate = today;
        user.dailyFreePackClaimed = false;
        user.cupCoins += 10;
    }

    if (telegramProfile.username) user.username = telegramProfile.username;
    if (telegramProfile.first_name) user.firstName = telegramProfile.first_name;

    await user.save();
    return user;
}

function serializeUser(user) {
    return {
        chatId: user.chatId,
        username: user.username,
        firstName: user.firstName,
        walletAddress: user.walletAddress,
        virtualBalance: Number(user.virtualBalance.toFixed(4)),
        cupCoins: user.cupCoins,
        inventory: user.inventory,
        gamePoints: user.gamePoints,
        dailyGamesPlayed: user.dailyGamesPlayed,
        gamesLeft: Math.max(0, economy.DAILY_GAME_LIMIT - user.dailyGamesPlayed),
        dailyFreePackClaimed: user.dailyFreePackClaimed,
        referralCode: user.referralCode,
        completedTasks: user.completedTasks,
        depositMemo: `${economy.DEPOSIT_MEMO_PREFIX}-${user.chatId}`
    };
}

module.exports = { getOrCreateUser, serializeUser, todayKey };
