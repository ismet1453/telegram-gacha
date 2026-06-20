require('dotenv').config();
const { Telegraf } = require('telegraf');
const User = require('./models/User');
const MatchPrediction = require('./models/MatchPrediction');
const { connectDB } = require('./database');
const { getOrCreateUser } = require('./services/userService');

async function startBot() {
    await connectDB();

    const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
    const webAppUrl = process.env.WEB_APP_URL;

    bot.start(async (ctx) => {
        const chatId = String(ctx.from.id);
        const payload = ctx.startPayload || '';

        const user = await getOrCreateUser(chatId, ctx.from);

        if (payload.startsWith('ref_') && payload !== user.referralCode && !user.referredBy) {
            const referrer = await User.findOne({ referralCode: payload });
            if (referrer && referrer.chatId !== chatId) {
                user.referredBy = referrer.chatId;
                await user.save();
            }
        }

        await ctx.reply(
            '🏆 *Welcome to Gacha Cup!*\n\nOpen packs, collect legendary jerseys, play mini-games, and sell rare cards.\n\nDeposit TON to your in-app balance, play with balance, and withdraw manually when you win big.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '⚽ Launch Game', web_app: { url: webAppUrl } }]]
                }
            }
        );
    });

    bot.command('predict', async (ctx) => {
        const today = new Date().toISOString().split('T')[0];
        const match = await MatchPrediction.findOne({ matchDate: today, active: true }).sort({ createdAt: -1 });

        if (!match) {
            return ctx.reply('No featured match today yet. Check back later!');
        }

        await ctx.reply(
            `⚽ *Today's Featured Match*\n${match.title}\n\n${match.teamA} vs ${match.teamB}\n\nOpen the Mini App to vote!`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: 'Vote in App', web_app: { url: webAppUrl } }]]
                }
            }
        );
    });

    bot.launch();
    console.log('Telegram bot is running.');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

startBot().catch((error) => {
    console.error('Bot failed to start:', error);
    process.exit(1);
});
