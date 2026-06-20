require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./database');
const apiRoutes = require('./routes/api');
const { startDepositWatcher } = require('./services/tonDepositWatcher');
const { processDeposit } = require('./services/gameService');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
