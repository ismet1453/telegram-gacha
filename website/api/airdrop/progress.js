const { MongoClient } = require('mongodb');

const MAX_TON = 4;
const INITIAL_PLAYERS = 1000;
const INITIAL_POOL = 4000;
const POOL_PER_CLAIM = 4;
const VALID_TASKS = new Set(['follow_x', 'retweet', 'share_post', 'join_telegram']);
const COLLECTION = 'airdropwallets';

let clientPromise;

function getUri() {
    return process.env.MONGO_URI || process.env.MONGODB_URI || '';
}

function getClient() {
    const uri = getUri();
    if (!uri) return null;

    if (!clientPromise) {
        const client = new MongoClient(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 20000
        });
        clientPromise = client.connect();
    }
    return clientPromise;
}

async function getCollection() {
    const client = await getClient();
    if (!client) throw new Error('MONGO_URI not configured');
    return client.db().collection(COLLECTION);
}

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

async function getStats(col) {
    const claimedCount = await col.countDocuments({ claimed: true });
    return {
        playersRemaining: Math.max(0, INITIAL_PLAYERS - claimedCount),
        tonPoolRemaining: Math.max(0, INITIAL_POOL - claimedCount * POOL_PER_CLAIM)
    };
}

module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!getUri()) {
        return res.status(503).json({
            success: false,
            message: 'MONGO_URI not set on Vercel. Add it in Project Settings → Environment Variables, then redeploy.'
        });
    }

    try {
        const col = await getCollection();

        if (req.method === 'GET') {
            const wallet = normalizeWallet(req.query.wallet);
            const stats = await getStats(col);

            if (wallet.length < 10) {
                return res.status(200).json({ success: true, progress: null, stats });
            }

            const doc = await col.findOne({ walletAddress: wallet });
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

            const existing = await col.findOne({ walletAddress: wallet });
            let doc;

            if (!existing) {
                doc = {
                    walletAddress: wallet,
                    completedTasks: tasks,
                    earnedTon,
                    claimed,
                    updatedAt: new Date()
                };
                await col.insertOne(doc);
            } else {
                const mergedTasks = [...new Set([...(existing.completedTasks || []), ...tasks])];
                doc = {
                    walletAddress: wallet,
                    completedTasks: mergedTasks,
                    earnedTon: Math.min(MAX_TON, Math.max(existing.earnedTon || 0, earnedTon, mergedTasks.length)),
                    claimed: existing.claimed || claimed,
                    updatedAt: new Date()
                };
                await col.updateOne({ walletAddress: wallet }, { $set: doc });
            }

            const stats = await getStats(col);
            return res.status(200).json({ success: true, progress: serialize(doc), stats });
        }

        return res.status(405).json({ success: false, message: 'Method not allowed' });
    } catch (error) {
        console.error('Airdrop API error:', error.message);
        return res.status(503).json({
            success: false,
            message: 'Database connection failed. Check MONGO_URI on Vercel and MongoDB Atlas Network Access (allow 0.0.0.0/0).'
        });
    }
};
