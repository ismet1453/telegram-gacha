const { connectDB } = require('../lib/db');
const AirdropWallet = require('../lib/AirdropWallet');

const MAX_TON = 4;
const INITIAL_PLAYERS = 1000;
const INITIAL_POOL = 4000;
const POOL_PER_CLAIM = 4;
const VALID_TASKS = new Set(['follow_x', 'retweet', 'share_post', 'join_telegram']);

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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

module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await connectDB();
    } catch (e) {
        return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    if (req.method === 'GET') {
        const wallet = normalizeWallet(req.query.wallet);
        if (wallet.length < 10) {
            const stats = await getStats();
            return res.status(200).json({ success: true, progress: null, stats });
        }

        const doc = await AirdropWallet.findOne({ walletAddress: wallet });
        const stats = await getStats();
        return res.status(200).json({
            success: true,
            progress: doc ? serialize(doc) : null,
            stats
        });
    }

    if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const wallet = normalizeWallet(body.walletAddress);
        if (wallet.length < 10) {
            return res.status(400).json({ success: false, message: 'Invalid wallet address' });
        }

        const tasks = Array.isArray(body.completedTasks)
            ? [...new Set(body.completedTasks.filter((t) => VALID_TASKS.has(t)))]
            : [];
        const earnedTon = Math.min(MAX_TON, Math.max(0, Number(body.earnedTon) || tasks.length));
        const claimed = !!body.claimed;

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
        return res.status(200).json({
            success: true,
            progress: serialize(doc),
            stats
        });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
};
