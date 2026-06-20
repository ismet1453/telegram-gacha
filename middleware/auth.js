const crypto = require('crypto');

function validateTelegramInitData(initData, botToken) {
    if (!initData || !botToken) return null;

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) return null;

    const authDate = Number(params.get('auth_date') || 0);
    const maxAgeSeconds = 86400;
    if (Date.now() / 1000 - authDate > maxAgeSeconds) return null;

    let user = null;
    try {
        user = JSON.parse(params.get('user') || 'null');
    } catch {
        return null;
    }

    if (!user?.id) return null;

    return {
        chatId: String(user.id),
        user
    };
}

function telegramAuthMiddleware(req, res, next) {
    const initData = req.headers['x-telegram-init-data'] || req.body?.initData;
    const botToken = process.env.TELEGRAM_TOKEN;

    if (process.env.NODE_ENV !== 'production' && req.body?.chatId && !initData) {
        req.telegramUser = { chatId: String(req.body.chatId) };
        return next();
    }

    const result = validateTelegramInitData(initData, botToken);
    if (!result) {
        return res.status(401).json({ success: false, message: 'Invalid Telegram authentication.' });
    }

    req.telegramUser = result;
    next();
}

function adminAuthMiddleware(req, res, next) {
    const adminId = String(process.env.ADMIN_TELEGRAM_ID || '');
    const chatId = req.headers['x-admin-id'] || req.body?.adminChatId;

    if (!adminId || String(chatId) !== adminId) {
        return res.status(403).json({ success: false, message: 'Admin access denied.' });
    }

    next();
}

module.exports = { validateTelegramInitData, telegramAuthMiddleware, adminAuthMiddleware };
