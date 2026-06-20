const economy = require('../config/economy');

function rollTierFromChances(chances) {
    const roll = Math.random() * 100;

    if (roll <= chances.LEGENDARY) return 'LEGENDARY';
    if (roll <= chances.LEGENDARY + chances.EPIC) return 'EPIC';
    if (roll <= chances.LEGENDARY + chances.EPIC + chances.RARE) return 'RARE';
    return 'COMMON';
}

function applyPity(packTypeKey, pityCounter, rolledTier) {
    const pity = economy.PITY[packTypeKey];
    if (!pity) return rolledTier;

    if (pityCounter >= pity.legendary) return 'LEGENDARY';
    if (pityCounter >= pity.epic && (rolledTier === 'COMMON' || rolledTier === 'RARE')) return 'EPIC';

    return rolledTier;
}

function buildCard(tierKey) {
    const tier = economy.TIERS[tierKey];
    const player = tier.players[Math.floor(Math.random() * tier.players.length)];

    return {
        uid: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        tierId: tier.id,
        tierName: tier.type,
        player: player.name,
        nation: player.nation,
        number: player.number,
        primary: player.primary,
        secondary: player.secondary,
        value: tier.value,
        burnReward: tier.burnReward
    };
}

function rollSingleCard(packTypeKey, pityCounter = 0) {
    const chances = economy.PACK_TYPES[packTypeKey].chances;
    let tierKey = rollTierFromChances(chances);
    tierKey = applyPity(packTypeKey, pityCounter, tierKey);
    return { card: buildCard(tierKey), tierKey };
}

function openPack(packTypeKey, pityCounter = 0) {
    if (!economy.PACK_TYPES[packTypeKey]) {
        throw new Error('Invalid pack type.');
    }

    const cards = [];
    let highestTier = 'COMMON';
    const tierRank = { COMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 };

    for (let i = 0; i < 3; i++) {
        const { card, tierKey } = rollSingleCard(packTypeKey, pityCounter);
        cards.push(card);
        if (tierRank[tierKey] > tierRank[highestTier]) highestTier = tierKey;
    }

    let newPityCounter = pityCounter + 1;
    if (tierRank[highestTier] >= tierRank.EPIC) {
        newPityCounter = 0;
    }

    return { cards, newPityCounter, highestTier };
}

module.exports = {
    openPack,
    economy,
    rollSingleCard,
    buildCard
};
