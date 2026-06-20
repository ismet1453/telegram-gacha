const express = require('express');
const { telegramAuthMiddleware, adminAuthMiddleware } = require('../middleware/auth');
const {
    getOrCreateUser,
    serializeUser,
    purchasePack,
    claimDailyFreePack,
    sellCard,
    burnCards,
    playGame,
    requestWithdraw
} = require('../services/gameService');
const economy = require('../config/economy');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const MatchPrediction = require('../models/MatchPrediction');

const router = express.Router();

router.post('/user', telegramAuthMiddleware, async (req, res) => {
    try {
        const chatId = req.telegramUser.chatId;
        const user = await getOrCreateUser(chatId, req.telegramUser.user || {});
        res.json({ success: true, user: serializeUser(user), packs: economy.PACK_TYPES, tiers: economy.TIERS });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/wallet', telegramAuthMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        const user = await getOrCreateUser(req.telegramUser.chatId);
        user.walletAddress = walletAddress || '';
        await user.save();
        res.json({ success: true, walletAddress: user.walletAddress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/deposit-info', telegramAuthMiddleware, async (req, res) => {
    try {
        const user = await getOrCreateUser(req.telegramUser.chatId);
        res.json({
            success: true,
            depositWallet: process.env.DEPOSIT_WALLET,
            memo: `${economy.DEPOSIT_MEMO_PREFIX}-${user.chatId}`,
            note: 'Send TON with this memo. Your in-app balance updates automatically within ~1 minute.'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/open-pack', telegramAuthMiddleware, async (req, res) => {
    try {
        const { packType } = req.body;
        const user = await getOrCreateUser(req.telegramUser.chatId);
        const items = await purchasePack(user, packType);
        const refreshed = await User.findOne({ chatId: user.chatId });
        res.json({ success: true, items, inventory: refreshed.inventory, balance: refreshed.virtualBalance });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.post('/claim-free-pack', telegramAuthMiddleware, async (req, res) => {
    try {
        const user = await getOrCreateUser(req.telegramUser.chatId);
        const items = await claimDailyFreePack(user);
        const refreshed = await User.findOne({ chatId: user.chatId });
        res.json({ success: true, items, inventory: refreshed.inventory, user: serializeUser(refreshed) });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.post('/play-game', telegramAuthMiddleware, async (req, res) => {
    try {
        const { score } = req.body;
        const user = await getOrCreateUser(req.telegramUser.chatId);
        const result = await playGame(user, Number(score));
        const refreshed = await User.findOne({ chatId: user.chatId });
        res.json({
            success: true,
            message: result.rewardMessage,
            newPoints: refreshed.gamePoints,
            cupCoins: refreshed.cupCoins,
            gamesLeft: result.gamesLeft,
            freePackItems: result.freePackItems,
            user: serializeUser(refreshed)
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.post('/burn', telegramAuthMiddleware, async (req, res) => {
    try {
        const { cardUids } = req.body;
        const user = await getOrCreateUser(req.telegramUser.chatId);
        const items = await burnCards(user, cardUids);
        const refreshed = await User.findOne({ chatId: user.chatId });
        res.json({
            success: true,
            message: '10 Common cards burned. You received a Silver pack!',
            items,
            newInventory: refreshed.inventory
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.post('/sell', telegramAuthMiddleware, async (req, res) => {
    try {
        const { cardUid } = req.body;
        const user = await getOrCreateUser(req.telegramUser.chatId);
        const result = await sellCard(user, cardUid);
        const refreshed = await User.findOne({ chatId: user.chatId });
        res.json({
            success: true,
            message: `Card sold! ${result.payout.toFixed(3)} TON added to your balance (${(economy.SELL_COMMISSION_RATE * 100).toFixed(0)}% fee).`,
            newInventory: refreshed.inventory,
            balance: refreshed.virtualBalance
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.post('/withdraw', telegramAuthMiddleware, async (req, res) => {
    try {
        const { amount, walletAddress } = req.body;
        const user = await getOrCreateUser(req.telegramUser.chatId);
        const withdrawal = await requestWithdraw(user, Number(amount), walletAddress || user.walletAddress);
        res.json({
            success: true,
            message: `Withdrawal request submitted. You will receive ${withdrawal.netAmount.toFixed(3)} TON after manual approval.`,
            withdrawal
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.get('/tasks', telegramAuthMiddleware, async (req, res) => {
    try {
        const user = await getOrCreateUser(req.telegramUser.chatId);
        const referralLink = `https://t.me/FootballjerseyGacha_bot?start=${user.referralCode}`;

        const tasks = [
            { id: 'daily_login', title: 'Daily Login', reward: '10 Cup Coins', done: user.completedTasks.includes('daily_login') },
            { id: 'open_pack', title: 'Open 1 Pack', reward: '25 Cup Coins', done: user.completedTasks.includes('open_pack') },
            { id: 'play_game', title: 'Play 1 Match', reward: '20 Cup Coins', done: user.completedTasks.includes('play_game') },
            { id: 'join_telegram', title: 'Join Telegram Channel', reward: '30 Cup Coins', url: process.env.TELEGRAM_CHANNEL, done: user.completedTasks.includes('join_telegram') },
            { id: 'follow_x', title: 'Follow on X', reward: '30 Cup Coins', url: process.env.X_ACCOUNT, done: user.completedTasks.includes('follow_x') },
            { id: 'share_x', title: 'Share on X', reward: '50 Cup Coins', shareUrl: referralLink, done: user.completedTasks.includes('share_x') }
        ];

        res.json({ success: true, tasks, referralLink, referralCommission: `${economy.REFERRAL_COMMISSION_RATE * 100}%` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/tasks/claim', telegramAuthMiddleware, async (req, res) => {
    try {
        const { taskId } = req.body;
        const rewards = {
            daily_login: 10,
            open_pack: 25,
            play_game: 20,
            join_telegram: 30,
            follow_x: 30,
            share_x: 50
        };

        if (!rewards[taskId]) {
            return res.status(400).json({ success: false, message: 'Invalid task.' });
        }

        const user = await getOrCreateUser(req.telegramUser.chatId);
        if (user.completedTasks.includes(taskId)) {
            return res.status(400).json({ success: false, message: 'Task already claimed.' });
        }

        user.completedTasks.push(taskId);
        user.cupCoins += rewards[taskId];
        await user.save();

        res.json({ success: true, message: `Task complete! +${rewards[taskId]} Cup Coins`, user: serializeUser(user) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/prediction/today', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const match = await MatchPrediction.findOne({ matchDate: today, active: true }).sort({ createdAt: -1 });
        res.json({ success: true, match });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/prediction/vote', telegramAuthMiddleware, async (req, res) => {
    try {
        const { matchId, choice } = req.body;
        const match = await MatchPrediction.findById(matchId);
        if (!match || !match.active) {
            return res.status(404).json({ success: false, message: 'No active match found.' });
        }

        if (!['teamA', 'teamB', 'draw'].includes(choice)) {
            return res.status(400).json({ success: false, message: 'Invalid vote.' });
        }

        match.votes[choice] += 1;
        await match.save();
        res.json({ success: true, message: 'Vote recorded!', votes: match.votes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/admin/summary', adminAuthMiddleware, async (req, res) => {
    try {
        const pendingWithdrawals = await Withdrawal.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(50);
        const userCount = await User.countDocuments();
        const totalDeposits = await Transaction.aggregate([
            { $match: { type: 'deposit' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalPackSales = await Transaction.aggregate([
            { $match: { type: 'pack_purchase' } },
            { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
        ]);

        res.json({
            success: true,
            stats: {
                userCount,
                totalDeposits: totalDeposits[0]?.total || 0,
                totalPackSales: totalPackSales[0]?.total || 0,
                pendingWithdrawals: pendingWithdrawals.length
            },
            pendingWithdrawals
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/admin/withdrawals/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }

        const withdrawal = await Withdrawal.findById(req.params.id);
        if (!withdrawal || withdrawal.status !== 'pending') {
            return res.status(404).json({ success: false, message: 'Withdrawal not found.' });
        }

        withdrawal.status = status;
        withdrawal.adminNote = adminNote || '';
        await withdrawal.save();

        if (status === 'rejected') {
            const user = await User.findOne({ chatId: withdrawal.chatId });
            if (user) {
                user.virtualBalance += withdrawal.amount;
                await user.save();
            }
        }

        res.json({ success: true, withdrawal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/admin/match', adminAuthMiddleware, async (req, res) => {
    try {
        const { title, teamA, teamB, matchDate } = req.body;
        await MatchPrediction.updateMany({ active: true }, { active: false });
        const match = await MatchPrediction.create({ title, teamA, teamB, matchDate });
        res.json({ success: true, match });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
