# Gacha Cup — Campaign Site

Standalone site using the **same visual theme as the Telegram Mini App** (`app.css`).

## TonConnect (wallet bağlama)

Telegram cüzdanı manifest dosyasını **herkese açık HTTPS** üzerinden okur. İki seçenek:

### A) Railway / Vercel API ile (önerilen)

1. Projeyi deploy et (`npm start` → Railway veya Vercel).
2. Kontrol et:
   - `https://SENIN-DOMAIN/tonconnect-manifest.json`
   - `https://SENIN-DOMAIN/logo.png`
3. Kampanya sayfasında `index.html` içindeki meta etiketini doldur:

```html
<meta name="ton-api-origin" content="https://SENIN-DOMAIN">
```

Boş bırakırsan manifest, sayfanın açıldığı domain üzerinden aranır (ör. `https://SENIN-DOMAIN/airdrop/`).

### B) Sadece statik hosting (GitHub Pages)

`tonconnect-manifest.json` ve `logo.png` dosyalarındaki `YOUR-DOMAIN` kısımlarını kendi Pages URL'inle değiştir.

## Open locally

```bash
cd website
npx serve .
```

Open the URL shown (e.g. `http://localhost:3000`).

## GitHub Pages

Upload the entire `website/` folder to a repo root → Settings → Pages → `main` / root.

