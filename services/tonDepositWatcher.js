const economy = require('../config/economy');

const TONAPI_BASE = 'https://tonapi.io/v2';

async function fetchRecentDeposits() {
    const wallet = process.env.DEPOSIT_WALLET;
    const apiKey = process.env.TONAPI_KEY;

    if (!wallet || !apiKey) return [];

    const response = await fetch(`${TONAPI_BASE}/blockchain/accounts/${wallet}/transactions?limit=30`, {
        headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (!response.ok) {
        console.error('TonAPI error:', response.status, await response.text());
        return [];
    }

    const data = await response.json();
    return data.transactions || [];
}

function nanoToTon(nano) {
    return Number(nano || 0) / 1e9;
}

function extractIncomingDeposits(transactions) {
    const wallet = process.env.DEPOSIT_WALLET;
    const deposits = [];

    for (const tx of transactions) {
        const hash = tx.hash;
        const inMsg = tx.in_msg;
        if (!inMsg || !inMsg.source || !inMsg.value) continue;

        const amountTon = nanoToTon(inMsg.value);
        if (amountTon <= 0) continue;

        let memo = '';
        if (typeof inMsg.decoded_body?.text === 'string') {
            memo = inMsg.decoded_body.text.trim();
        } else if (typeof inMsg.message === 'string') {
            memo = inMsg.message.trim();
        }

        const prefix = economy.DEPOSIT_MEMO_PREFIX;
        if (!memo.startsWith(prefix + '-')) continue;

        const chatId = memo.replace(`${prefix}-`, '').trim();
        if (!/^\d+$/.test(chatId)) continue;

        deposits.push({
            txHash: hash,
            chatId,
            amountTon,
            memo
        });
    }

    return deposits;
}

async function pollDeposits(processDepositFn) {
    try {
        const transactions = await fetchRecentDeposits();
        const deposits = extractIncomingDeposits(transactions);

        for (const deposit of deposits) {
            await processDepositFn(deposit);
        }
    } catch (error) {
        console.error('Deposit poll failed:', error.message);
    }
}

function startDepositWatcher(processDepositFn, intervalMs = 30000) {
    console.log('TON deposit watcher started.');
    pollDeposits(processDepositFn);
    return setInterval(() => pollDeposits(processDepositFn), intervalMs);
}

module.exports = { startDepositWatcher, extractIncomingDeposits, nanoToTon };
