require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./database');
const apiRoutes = require('./routes/api');
const campaignRoutes = require('./routes/campaign');
const { startDepositWatcher } = require('./services/tonDepositWatcher');
const { processDeposit } = require('./services/gameService');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/tonconnect-manifest.json', (req, res) => {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    const origin = `${proto}://${host}`.replace(/\/$/, '');
    res.set('Cache-Control', 'no-store');
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
        url: origin,
        name: 'Gacha Cup',
        iconUrl: `${origin}/icon.png`,
        termsOfUseUrl: 'https://t.me/FootballGacha',
        privacyPolicyUrl: 'https://t.me/FootballGacha'
    });
});

app.use('/airdrop', express.static(path.join(__dirname, 'website')));
app.use('/site', express.static(path.join(__dirname, 'public/site')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/campaign', campaignRoutes);
app.use('/api', apiRoutes);

app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'Gacha Cup API' });
});

async function bootstrap() {
    await connectDB();

    if (process.env.TONAPI_KEY && process.env.DEPOSIT_WALLET) {
        startDepositWatcher(processDeposit, 30000);
    } else {
        console.warn('TON deposit watcher disabled: TONAPI_KEY or DEPOSIT_WALLET missing.');
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Gacha Cup API running on port ${PORT}`);
    });
}

bootstrap().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = app;
