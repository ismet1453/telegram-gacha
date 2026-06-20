const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const { openPack, economy } = require('./gachaEngine');
const { getOrCreateUser, serializeUser, todayKey } = require('./userService');

async function processDeposit({ txHash, chatId, amountTon, memo }) {
    const existing = await Transaction.findOne({ txHash, type: 'deposit' });
    if (existing) return null;

    const user = await getOrCreateUser(chatId);
    user.virtualBalance += amountTon;
    await user.save();

    await Transaction.create({
        chatId: user.chatId,
        type: 'deposit',
        amount: amountTon,
        txHash,
        metadata: { memo }
    });

    console.log(`Deposit credited: ${amountTon} TON -> user ${chatId}`);
    return user;
}

async function purchasePack(user, packType) {
    const pack = economy.PACK_TYPES[packType];
    if (!pack) throw new Error('Invalid pack type.');

    if (user.virtualBalance < pack.price) {
        throw new Error('Insufficient balance. Please deposit TON first.');
    }

    user.virtualBalance -= pack.price;
    const pityCounter = user.pityCounters[packType] || 0;
    const { cards, newPityCounter } = openPack(packType, pityCounter);
    user.pityCounters[packType] = newPityCounter;
    user.inventory.push(...cards);
    await user.save();

    await Transaction.create({
        chatId: user.chatId,
        type: 'pack_purchase',
        amount: -pack.price,
        metadata: { packType, cards }
    });

    if (user.referredBy) {
        const referrer = await User.findOne({ chatId: user.referredBy });
        if (referrer) {
            const commission = pack.price * economy.REFERRAL_COMMISSION_RATE;
            referrer.virtualBalance += commission;
            await referrer.save();
            await Transaction.create({
                chatId: referrer.chatId,
                type: 'referral',
                amount: commission,
                metadata: { fromUser: user.chatId, packType }
            });
        }
    }

    return cards;
}

async function claimDailyFreePack(user) {
    const today = todayKey();
    if (user.lastLoginDate !== today || user.dailyFreePackClaimed) {
        throw new Error('Daily free pack already claimed.');
    }

    if (user.cupCoins < economy.CUP_COINS_FOR_FREE_PACK) {
        throw new Error(`You need ${economy.CUP_COINS_FOR_FREE_PACK} Cup Coins for a free pack.`);
    }

    user.cupCoins -= economy.CUP_COINS_FOR_FREE_PACK;
    user.dailyFreePackClaimed = true;

    const pityCounter = user.pityCounters.BRONZE || 0;
    const { cards, newPityCounter } = openPack('BRONZE', pityCounter);
    user.pityCounters.BRONZE = newPityCounter;
    user.inventory.push(...cards);
    await user.save();

    await Transaction.create({
        chatId: user.chatId,
        type: 'free_pack',
        amount: 0,
        metadata: { cards }
    });

    return cards;
}

async function sellCard(user, cardUid) {
    const cardIndex = user.inventory.findIndex((item) => item.uid === cardUid);
    if (cardIndex === -1) throw new Error('Card not found.');

    const card = user.inventory[cardIndex];
    if (card.value <= 0) throw new Error('This card cannot be sold.');

    const commission = card.value * economy.SELL_COMMISSION_RATE;
    const payout = card.value - commission;

    user.inventory.splice(cardIndex, 1);
    user.virtualBalance += payout;
    await user.save();

    await Transaction.create({
        chatId: user.chatId,
        type: 'card_sell',
        amount: payout,
        metadata: { card, commission }
    });

    return { payout, commission, card };
}

async function burnCards(user, cardUids) {
    if (!cardUids || cardUids.length !== 10) {
        throw new Error('You must select exactly 10 cards.');
    }

    const cardsToBurn = user.inventory.filter((item) => cardUids.includes(item.uid));
    if (cardsToBurn.length !== 10 || cardsToBurn.some((c) => c.tierId !== 1)) {
        throw new Error('You can only burn 10 Common cards from your inventory.');
    }

    user.inventory = user.inventory.filter((item) => !cardUids.includes(item.uid));

    const pityCounter = user.pityCounters.SILVER || 0;
    const { cards, newPityCounter } = openPack('SILVER', pityCounter);
    user.pityCounters.SILVER = newPityCounter;
    user.inventory.push(...cards);
    await user.save();

    await Transaction.create({
        chatId: user.chatId,
        type: 'burn',
        amount: 0,
        metadata: { burned: cardUids, received: cards }
    });

    return cards;
}

async function playGame(user, score) {
    const today = todayKey();

    if (user.lastGameDate === today && user.dailyGamesPlayed >= economy.DAILY_GAME_LIMIT) {
        throw new Error('Daily game limit reached. Come back tomorrow.');
    }

    if (score > economy.MAX_GAME_SCORE || score < 0) {
        throw new Error('Invalid score detected.');
    }

    user.cupCoins += Math.floor(score / 10);
    user.gamePoints += score;
    user.dailyGamesPlayed += 1;
    user.lastGameDate = today;

    let freePackItems = [];
    let rewardMessage = `You earned ${score} points and ${Math.floor(score / 10)} Cup Coins.`;

    if (user.gamePoints >= 100) {
        user.gamePoints -= 100;
        const pityCounter = user.pityCounters.BRONZE || 0;
        const result = openPack('BRONZE', pityCounter);
        user.pityCounters.BRONZE = result.newPityCounter;
        freePackItems = result.cards;
        user.inventory.push(...freePackItems);
        rewardMessage = `You earned ${score} points and unlocked a free Bronze pack!`;
    }

    await user.save();

    await Transaction.create({
        chatId: user.chatId,
        type: 'game_reward',
        amount: score,
        metadata: { freePackItems }
    });

    return { rewardMessage, freePackItems, gamesLeft: economy.DAILY_GAME_LIMIT - user.dailyGamesPlayed };
}

async function requestWithdraw(user, amount, walletAddress) {
    if (!walletAddress) throw new Error('Please link a TON wallet first.');
    if (amount < economy.MIN_WITHDRAW) {
        throw new Error(`Minimum withdrawal is ${economy.MIN_WITHDRAW} TON.`);
    }

    const totalDeduction = amount;
    const fee = economy.WITHDRAW_FEE;
    const netAmount = amount - fee;

    if (netAmount <= 0) throw new Error('Withdraw amount too low after fee.');
    if (user.virtualBalance < totalDeduction) throw new Error('Insufficient balance.');

    user.virtualBalance -= totalDeduction;
    user.walletAddress = walletAddress;
    await user.save();

    const withdrawal = await Withdrawal.create({
        chatId: user.chatId,
        amount: totalDeduction,
        fee,
        netAmount,
        walletAddress,
        status: 'pending'
    });

    await Transaction.create({
        chatId: user.chatId,
        type: 'withdraw_request',
        amount: -totalDeduction,
        status: 'pending',
        metadata: { withdrawalId: withdrawal._id, netAmount, walletAddress }
    });

    return withdrawal;
}

module.exports = {
    processDeposit,
    purchasePack,
    claimDailyFreePack,
    sellCard,
    burnCards,
    playGame,
    requestWithdraw,
    getOrCreateUser,
    serializeUser
};
