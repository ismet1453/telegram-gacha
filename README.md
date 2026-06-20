# Gacha Cup

Telegram Mini App gacha game with virtual TON balance, Cup Coins, and manual withdrawals.

## Local run

```powershell
cd C:\Users\USER\Desktop\TelegramGacha
npm install
npm start
```

Copy `.env.example` to `.env` and fill values.

## Railway deploy

1. Push repo to GitHub (private recommended)
2. Railway → New Project → Deploy from GitHub
3. Add environment variables from `.env.example`
4. Set `WEB_APP_URL` to your Railway domain
5. MongoDB Atlas → Network Access → add `0.0.0.0/0`
6. BotFather → set Mini App URL to Railway domain

## Scripts

- `npm start` — server + bot
- `npm run simulate` — economy house-edge simulation

## Deposit flow

Users send TON to `DEPOSIT_WALLET` with memo `DEP-{telegramUserId}`.
TonAPI watcher credits virtual in-app balance automatically.

## Withdraw flow

Users request withdrawal in app → admin approves in `/admin.html` → send TON manually.
