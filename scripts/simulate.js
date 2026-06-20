const { openPack, economy } = require('../services/gachaEngine');

function simulate(packType, iterations = 10000) {
    let totalCardValue = 0;
    let totalSpent = 0;
    let pityCounter = 0;
    const tierCounts = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 };

    for (let i = 0; i < iterations; i++) {
        const pack = economy.PACK_TYPES[packType];
        totalSpent += pack.price;
        const result = openPack(packType, pityCounter);
        pityCounter = result.newPityCounter;

        for (const card of result.cards) {
            totalCardValue += card.value;
            const tierKey = Object.keys(economy.TIERS).find((key) => economy.TIERS[key].id === card.tierId);
            if (tierKey) tierCounts[tierKey] += 1;
        }
    }

    const cardsOpened = iterations * 3;
    const houseEdge = ((totalSpent - totalCardValue) / totalSpent) * 100;

    return {
        packType,
        iterations,
        cardsOpened,
        totalSpent: totalSpent.toFixed(2),
        totalCardValue: totalCardValue.toFixed(2),
        houseEdgePercent: houseEdge.toFixed(2),
        avgValuePerPack: (totalCardValue / iterations).toFixed(4),
        tierCounts
    };
}

console.log('Gacha Cup Economy Simulation\n');

for (const packType of Object.keys(economy.PACK_TYPES)) {
    const result = simulate(packType, 10000);
    console.log(JSON.stringify(result, null, 2));
    console.log('---');
}
