# Gacha Cup — Campaign Site

Bağımsız kampanya sitesi (`footballgacha.sbs`). **Vercel** (hosting + API) + **MongoDB Atlas** (claim kayıtları).

Railway veya Telegram mini app gerekmez.

## Deploy

1. Vercel projesi → Root Directory: `website`
2. `MONGO_URI` environment variable (Atlas connection string)
3. Detaylı kurulum: [VERCEL-SETUP.md](./VERCEL-SETUP.md)

## Local preview

```bash
cd website
npx serve .
```

## API

- `GET /api/airdrop/progress` — havuz istatistikleri
- `POST /api/airdrop/progress` — görev + claim kaydı
