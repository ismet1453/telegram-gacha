// gachaLogic.js

// 1. Kart Nadirlik Seviyeleri ve Piyasa Değerleri
// Sıradan ve Nadir kartlar TON ile satılamaz (Değer: 0), sadece yakılarak (burn) puan elde edilir.
const TIERS = {
    COMMON: { id: 1, type: "Sıradan", value: 0, burnReward: 10, players: ["Rotasyon Oyuncusu 1", "Rotasyon Oyuncusu 2", "Rotasyon Oyuncusu 3", "Rotasyon Oyuncusu 4"] },
    RARE: { id: 2, type: "Nadir", value: 0, burnReward: 50, players: ["Enzo Fernandez", "Cody Gakpo", "Achraf Hakimi", "Son Heung-min"] },
    EPIC: { id: 3, type: "Destansı", value: 0.5, burnReward: 200, players: ["Arda Güler", "Jude Bellingham", "Jamal Musiala", "Kevin De Bruyne"] },
    LEGENDARY: { id: 4, type: "Efsanevi", value: 5.0, burnReward: 5000, players: ["Lionel Messi", "Cristiano Ronaldo", "Kylian Mbappe", "Pele"] }
};

// 2. Paket Fiyatları ve Çıkma İhtimalleri (%)
// Kasanın avantajı (House Edge) burada maksimuma çıkarıldı.
const PACK_TYPES = {
    BRONZE: { price: 0.2, chances: { COMMON: 99.0, RARE: 1.0, EPIC: 0.0, LEGENDARY: 0.0 } },
    SILVER: { price: 1.0, chances: { COMMON: 90.0, RARE: 9.9, EPIC: 0.1, LEGENDARY: 0.0 } },
    GOLD:   { price: 3.0, chances: { COMMON: 70.0, RARE: 20.0, EPIC: 9.0, LEGENDARY: 1.0 } },
    DIAMOND:{ price: 7.0, chances: { COMMON: 45.0, RARE: 35.0, EPIC: 15.0, LEGENDARY: 5.0 } }
};

// Tek bir kart çekme algoritması
function rollSingleCard(packTypeKey) {
    const chances = PACK_TYPES[packTypeKey].chances;
    const roll = Math.random() * 100;
    let tier;

    if (roll <= chances.LEGENDARY) {
        tier = TIERS.LEGENDARY;
    } else if (roll <= (chances.LEGENDARY + chances.EPIC)) {
        tier = TIERS.EPIC;
    } else if (roll <= (chances.LEGENDARY + chances.EPIC + chances.RARE)) {
        tier = TIERS.RARE;
    } else {
        tier = TIERS.COMMON;
    }

    const randomPlayer = tier.players[Math.floor(Math.random() * tier.players.length)];
    
    return {
        uid: Date.now() + Math.random().toString(36).substr(2, 9), // Benzersiz kart ID'si
        tierId: tier.id,
        tierName: tier.type,
        player: randomPlayer,
        value: tier.value,
        burnReward: tier.burnReward
    };
}

// Belirli bir paketten 3 adet kart çıkaran ana fonksiyon
function openPack(packTypeKey) {
    if (!PACK_TYPES[packTypeKey]) throw new Error("Geçersiz Paket Türü!");
    
    return [
        rollSingleCard(packTypeKey),
        rollSingleCard(packTypeKey),
        rollSingleCard(packTypeKey)
    ];
}

module.exports = { openPack, TIERS, PACK_TYPES };