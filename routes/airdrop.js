const express = require('express');
const AirdropWallet = require('../models/AirdropWallet');

const router = express.Router();

const MAX_TON = 4;
const INITIAL_PLAYERS = 1000;
const INITIAL_POOL = 4000;
const POOL_PER_CLAIM = 4;
const VALID_TASKS = new Set(['follow_x', 'retweet', 'share_post', 'join_telegram']);

function normalizeWallet(w) {
    return String(w || '').trim();
}

function serialize(doc) {
    return {
        walletAddress: doc.walletAddress,
        completedTasks: doc.completedTasks || [],
        earnedTon: doc.earnedTon || 0,
        claimed: !!doc.claimed
    };
}

async function getStats() {
    const claimedCount = await AirdropWallet.countDocuments({ claimed: true });
    return {
        playersRemaining: Math.max(0, INITIAL_PLAYERS - claimedCount),
        tonPoolRemaining: Math.max(0, INITIAL_POOL - claimedCount * POOL_PER_CLAIM)
    };
}

router.get('/progress', async (req, res) => {
    try {
        const wallet = normalizeWallet(req.query.wallet);
        const stats = await getStats();

        if (wallet.length < 10) {
            return res.json({ success: true, progress: null, stats });
        }

        const doc = await AirdropWallet.findOne({ walletAddress: wallet });
        res.json({
            success: true,
            progress: doc ? serialize(doc) : null,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/progress', async (req, res) => {
    try {
        const wallet = normalizeWallet(req.body.walletAddress);
        if (wallet.length < 10) {
            return res.status(400).json({ success: false, message: 'Invalid wallet address' });
        }

        const tasks = Array.isArray(req.body.completedTasks)
            ? [...new Set(req.body.completedTasks.filter((t) => VALID_TASKS.has(t)))]
            : [];
        const earnedTon = Math.min(MAX_TON, Math.max(0, Number(req.body.earnedTon) || tasks.length));
        const claimed = !!req.body.claimed;

        let doc = await AirdropWallet.findOne({ walletAddress: wallet });
        if (!doc) {
            doc = await AirdropWallet.create({
                walletAddress: wallet,
                completedTasks: tasks,
                earnedTon,
                claimed
            });
        } else {
            const mergedTasks = [...new Set([...(doc.completedTasks || []), ...tasks])];
            doc.completedTasks = mergedTasks;
            doc.earnedTon = Math.min(MAX_TON, Math.max(doc.earnedTon, earnedTon, mergedTasks.length));
            if (claimed) doc.claimed = true;
            await doc.save();
        }

        const stats = await getStats();
        res.json({ success: true, progress: serialize(doc), stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
