# Vercel — bağımsız kampanya sitesi (footballgacha.sbs)

Site tamamen **Vercel + MongoDB Atlas** ile çalışır. Railway veya başka backend gerekmez.

## 1) MongoDB Atlas hesabı (ücretsiz)

GitHub ile giriş çalışmıyorsa **e-posta ile yeni hesap** aç:

1. https://www.mongodb.com/cloud/atlas/register  
2. **Sign up with Email** (GitHub kullanma)  
3. **Create** → **M0 FREE** cluster (herhangi bir bölge)  
4. **Database Access** → Add user → kullanıcı adı + güçlü şifre (kaydet)  
5. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)  
6. **Database** → **Connect** → **Drivers** → connection string kopyala  
   - Örnek: `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/gachaCup?retryWrites=true&w=majority`  
   - Şifrede `@`, `#`, `:` varsa [URL encode](https://www.urlencoder.org/) et

## 2) Vercel’e MONGO_URI ekle

1. [vercel.com](https://vercel.com) → **telegram-gacha** projesi  
2. **Settings → Environment Variables**  
3. Name: `MONGO_URI` → Value: Atlas connection string  
4. Environment: **Production** (+ Preview önerilir)  
5. **Save** → **Deployments → Redeploy**

## 3) Test

```
https://footballgacha.sbs/api/airdrop/progress
```

Beklenen:
```json
{"success":true,"progress":null,"stats":{"playersRemaining":500,"tonPoolRemaining":500}}
```

Claim sonrası `playersRemaining` 499, `tonPoolRemaining` 499 olmalı (kişi başı 1 TON).

## Sık hatalar

| Mesaj | Çözüm |
|--------|--------|
| `MONGO_URI not set` | Vercel env ekle + redeploy |
| `MongoDB login failed` | Kullanıcı/şifre veya URL-encoded şifre |
| `Database connection failed` | Atlas → Network Access → `0.0.0.0/0` |
| `not primary` / reconnecting | Birkaç saniye bekle, tekrar dene (kod otomatik retry yapar) |
