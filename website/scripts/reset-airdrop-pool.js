/**
 * Reset campaign airdrop claims only (airdropwallets collection).
 * Usage from repo root: node website/scripts/reset-airdrop-pool.js --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { MongoClient, ServerApiVersion } = require('mongodb');

const COLLECTION = 'airdropwallets';

async function main() {
    if (!process.argv.includes('--yes')) {
        console.log('\nThis deletes ALL campaign claim records (airdropwallets).');
        console.log('Pool will show 500 players / 500 TON again after deploy.\n');
        console.log('  node website/scripts/reset-airdrop-pool.js --yes\n');
        process.exit(1);
    }

    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGO_URI not found in .env');
        process.exit(1);
    }

    const client = new MongoClient(uri, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
    });

    try {
        await client.connect();
        const col = client.db().collection(COLLECTION);
        const { deletedCount } = await col.deleteMany({});
        console.log(`Cleared airdropwallets: ${deletedCount} document(s) removed.`);
        console.log('Redeploy Vercel if needed, then check /api/airdrop/progress');
    } finally {
        await client.close();
    }
}

main().catch((err) => {
    console.error('Reset failed:', err.message);
    process.exit(1);
});
