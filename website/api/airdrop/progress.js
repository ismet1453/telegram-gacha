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
    let s = String(w || '').trim().replace(/\s+/g, '');
    const friendly = s.match(/(?:EQ|UQ|kQ|eq|uq|kq)[A-Za-z0-9_-]{43,48}/i);
    if (friendly) {
        const addr = friendly[0];
        return addr.slice(0, 2).toUpperCase() + addr.slice(2);
    }
    const raw = s.match(/0:[a-fA-F0-9]{64}/);
    if (raw) return raw[0];
    return s;
}

function isValidWallet(wallet) {
    const w = normalizeWallet(wallet);
    if (w.startsWith('0:')) return /^0:[a-fA-F0-9]{64}$/.test(w);
    return /^[EUk]Q[A-Za-z0-9_-]{43,48}$/.test(w);
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

async function readRequestBody(req) {
    if (req.body !== undefined && req.body !== null) {
        if (typeof req.body === 'string') {
            const text = req.body.trim();
            return text ? JSON.parse(text) : {};
        }
        if (Buffer.isBuffer(req.body)) {
            const text = req.body.toString('utf8').trim();
            return text ? JSON.parse(text) : {};
        }
        if (typeof req.body === 'object') {
            return req.body;
        }
    }

    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            try {
                resolve(raw.trim() ? JSON.parse(raw) : {});
            } catch (error) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
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

            if (!isValidWallet(wallet)) {
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
            let body;
            try {
                body = await readRequestBody(req);
            } catch {
                return res.status(400).json({ success: false, message: 'Invalid request body' });
            }

            const wallet = normalizeWallet(body.walletAddress);
            if (!isValidWallet(wallet)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid TON wallet. Paste the full address from your wallet (UQ... or EQ...).'
                });
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
        const msg = error.message === 'MONGO_URI not configured'
            ? 'MONGO_URI not set on Vercel. Add it in Project Settings → Environment Variables, then redeploy.'
            : (error.message || 'Server error');
        return res.status(503).json({
            success: false,
            message: msg.includes('MONGO') || msg.includes('connect')
                ? 'Database connection failed. Check MONGO_URI on Vercel and MongoDB Atlas Network Access (allow 0.0.0.0/0).'
                : msg
        });
    }
};
