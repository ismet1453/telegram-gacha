const { spawn } = require('child_process');
require('dotenv').config();

(async () => {
    const PORT = process.env.PORT || 3000;
    console.log("⚙️ Sistemler ayağa kaldırılıyor...");

    // 1. Sunucuyu başlat
    const server = spawn('node', ['server.js'], { stdio: 'inherit', shell: true });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("🌍 Cloudflare Tüneli açılıyor (Windows shell entegrasyonu aktif)...");

    // 2. Cloudflare Tünelini Başlat (EINVAL Hatası için shell: true eklendi)
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const cloudflare = spawn(npx, ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], { shell: true });

    let botStarted = false;

    // Cloudflare loglarını dinle ve güvenli linki yakala
    cloudflare.stderr.on('data', (data) => {
        const output = data.toString();
        
        // trycloudflare.com uzantılı linki bul
        const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        
        if (match && !botStarted) {
            botStarted = true;
            const url = match[0];
            console.log(`\n✅ Kesintisiz Web App Linki Oluşturuldu: ${url}\n`);
            
            // Linki bota ilet ve botu başlat
            process.env.WEB_APP_URL = url;
            spawn('node', ['bot.js'], { stdio: 'inherit', shell: true });
        }
    });

    cloudflare.on('error', (err) => console.error("❌ Cloudflare Tünel Hatası:", err));

    // Terminal kapandığında işlemleri temizle
    process.on('SIGINT', () => {
        server.kill();
        cloudflare.kill();
        process.exit();
    });
})();