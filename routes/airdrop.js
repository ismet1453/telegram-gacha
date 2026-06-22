const express = require('express');
const AirdropWallet = require('../models/AirdropWallet');

const router = express.Router();

const MAX_TON = 1;
const TASK_REWARD = 0.25;
const INITIAL_PLAYERS = 500;
const INITIAL_POOL = 500;
const POOL_PER_CLAIM = 1;
const VALID_TASKS = new Set(['follow_x', 'retweet', 'share_post', 'join_telegram']);

function normalizeWallet(w) {
    let s = String(w || '').trim().replace(/\s+/g, '');
    const friendly = s.match(/(?:EQ|UQ|kQ)[A-Za-z0-9_-]{46}/);
    if (friendly) return friendly[0];
    const raw = s.match(/0:[a-fA-F0-9]{64}/);
    if (raw) return raw[0];
    return s;
}

function isValidWallet(wallet) {
    const w = normalizeWallet(wallet);
    if (w.startsWith('0:')) return w.length >= 66;
    return w.length >= 48 && /^(EQ|UQ|kQ)/.test(w);
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

        if (!isValidWallet(wallet)) {
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
        if (!isValidWallet(wallet)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid TON wallet address. Paste your full UQ... or EQ... address (48 characters).'
            });
        }

        const tasks = Array.isArray(req.body.completedTasks)
            ? [...new Set(req.body.completedTasks.filter((t) => VALID_TASKS.has(t)))]
            : [];
        const earnedTon = Math.min(MAX_TON, Math.max(0, Number(req.body.earnedTon) || tasks.length * TASK_REWARD));
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
            doc.earnedTon = Math.min(MAX_TON, Math.max(doc.earnedTon, earnedTon, mergedTasks.length * TASK_REWARD));
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
