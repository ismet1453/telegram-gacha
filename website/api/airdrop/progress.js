const { MongoClient, ServerApiVersion } = require('mongodb');

const MAX_TON = 1;
const TASK_REWARD = 0.25;
const INITIAL_PLAYERS = 500;
const INITIAL_POOL = 500;
const POOL_PER_CLAIM = 1;
const VALID_TASKS = new Set(['follow_x', 'retweet', 'share_post', 'join_telegram']);
const COLLECTION = 'airdropwallets';
const DEFAULT_DB = 'gachaCup';

function getUri() {
    return process.env.MONGO_URI || process.env.MONGODB_URI || '';
}

function getDbName() {
    const uri = getUri();
    const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
    return process.env.MONGO_DB_NAME || DEFAULT_DB;
}

function isRetryableMongoError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes('not primary')
        || msg.includes('not writable')
        || msg.includes('node is recovering')
        || msg.includes('econnreset')
        || msg.includes('server selection')
        || msg.includes('topology') && msg.includes('destroyed');
}

function clientOptions() {
    return {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true
        },
        maxPoolSize: 1,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        readPreference: 'primary',
        retryWrites: true,
        retryReads: true
    };
}

async function withCollection(fn, attempts = 5) {
    const uri = getUri();
    if (!uri) throw new Error('MONGO_URI not configured');

    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const client = new MongoClient(uri, clientOptions());
        try {
            await client.connect();
            const col = client.db(getDbName()).collection(COLLECTION);
            return await fn(col);
        } catch (err) {
            lastError = err;
            if (!isRetryableMongoError(err) || attempt === attempts - 1) throw err;
            await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        } finally {
            await client.close().catch(() => {});
        }
    }
    throw lastError;
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
            } catch {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function formatError(error) {
    const raw = String(error.message || 'Server error');
    const lower = raw.toLowerCase();

    if (raw === 'MONGO_URI not configured') {
        return 'MONGO_URI not set on Vercel. Add your MongoDB Atlas connection string, then redeploy.';
    }
    if (lower.includes('authentication') || lower.includes('auth failed') || lower.includes('bad auth')) {
        return 'MongoDB login failed. Check username/password in MONGO_URI on Vercel (encode special characters in the password).';
    }
    if (isRetryableMongoError(error)) {
        return 'Database is reconnecting. Wait a moment and tap Claim again.';
    }
    if (lower.includes('network') || lower.includes('connect') || lower.includes('timed out')) {
        return 'Database connection failed. In MongoDB Atlas → Network Access, allow 0.0.0.0/0, then redeploy Vercel.';
    }
    return raw;
}

module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!getUri()) {
        return res.status(503).json({
            success: false,
            message: 'MONGO_URI not set on Vercel. Add your MongoDB Atlas connection string, then redeploy.'
        });
    }

    try {
        if (req.method === 'GET') {
            const wallet = normalizeWallet(req.query.wallet);
            const result = await withCollection(async (col) => {
                const stats = await getStats(col);
                if (!isValidWallet(wallet)) {
                    return { success: true, progress: null, stats };
                }
                const doc = await col.findOne({ walletAddress: wallet });
                return {
                    success: true,
                    progress: doc ? serialize(doc) : null,
                    stats
                };
            });
            return res.status(200).json(result);
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
            const earnedTon = Math.min(MAX_TON, Math.max(0, Number(body.earnedTon) || tasks.length * TASK_REWARD));
            const claimed = !!body.claimed;

            const result = await withCollection(async (col) => {
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
                        earnedTon: Math.min(MAX_TON, Math.max(existing.earnedTon || 0, earnedTon, mergedTasks.length * TASK_REWARD)),
                        claimed: existing.claimed || claimed,
                        updatedAt: new Date()
                    };
                    await col.updateOne({ walletAddress: wallet }, { $set: doc });
                }

                const stats = await getStats(col);
                return { success: true, progress: serialize(doc), stats };
            });

            return res.status(200).json(result);
        }

        return res.status(405).json({ success: false, message: 'Method not allowed' });
    } catch (error) {
        console.error('Airdrop API error:', error.message);
        return res.status(503).json({ success: false, message: formatError(error) });
    }
};
