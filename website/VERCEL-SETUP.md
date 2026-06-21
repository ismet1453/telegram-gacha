# Vercel — canlı havuz için zorunlu ayar

Site `footballgacha.sbs` üzerinde çalışıyor ama **havuz / oyuncu sayısı** ve **cüzdan ilerlemesi** için MongoDB gerekir.

## 1) MONGO_URI ekle (2 dk)

1. Bilgisayarında `TelegramGacha/.env` dosyasını aç  
2. `MONGO_URI=mongodb+srv://...` satırının **tamamını** kopyala  
3. [vercel.com](https://vercel.com) → **telegram-gacha** projesi  
4. **Settings → Environment Variables**  
5. **Add:**
   - Name: `MONGO_URI`
   - Value: yapıştır (mongodb bağlantı dizesi)
   - Environment: **Production** ✓ (Preview + Development da işaretle)
6. **Save**  
7. **Deployments** → son deploy → **⋯ → Redeploy**

## 2) MongoDB Atlas — ağ erişimi

1. [cloud.mongodb.com](https://cloud.mongodb.com) → cluster  
2. **Network Access** → **Add IP Address**  
3. **Allow Access from Anywhere** (`0.0.0.0/0`)  
   - Vercel sunucuları sabit IP kullanmaz; bu şart.

## 3) Test

Tarayıcıda aç:

```
https://footballgacha.sbs/api/airdrop/progress
```

**Çalışıyorsa:**
```json
{"success":true,"progress":null,"stats":{"playersRemaining":1000,"tonPoolRemaining":4000}}
```

**Hâlâ hata varsa:** mesajdaki metne bak — `MONGO_URI not set` veya `connection failed`.

## Nasıl azalır?

Biri **CLAIM AIRDROP** yaptığında:
- `playersRemaining` → 1 azalır  
- `tonPoolRemaining` → 4 azalır  

Tüm ziyaretçiler aynı sayıları görür.
