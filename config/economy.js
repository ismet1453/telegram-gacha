module.exports = {
    SELL_COMMISSION_RATE: 0.08,
    WITHDRAW_FEE: 0.05,
    MIN_WITHDRAW: 0.5,
    REFERRAL_COMMISSION_RATE: 0.03,

    DAILY_FREE_PACK: 'BRONZE',
    CUP_COINS_FOR_FREE_PACK: 100,
    DAILY_GAME_LIMIT: 2,
    MAX_GAME_SCORE: 600,

    DEPOSIT_MEMO_PREFIX: 'DEP',

    PITY: {
        BRONZE: { epic: 80, legendary: 200 },
        SILVER: { epic: 40, legendary: 120 },
        GOLD: { epic: 25, legendary: 60 },
        DIAMOND: { epic: 15, legendary: 35 }
    },

    PACK_TYPES: {
        BRONZE: { price: 0.2, chances: { COMMON: 99.0, RARE: 1.0, EPIC: 0.0, LEGENDARY: 0.0 } },
        SILVER: { price: 1.0, chances: { COMMON: 90.0, RARE: 9.9, EPIC: 0.1, LEGENDARY: 0.0 } },
        GOLD: { price: 3.0, chances: { COMMON: 70.0, RARE: 20.0, EPIC: 9.0, LEGENDARY: 1.0 } },
        DIAMOND: { price: 7.0, chances: { COMMON: 45.0, RARE: 35.0, EPIC: 15.0, LEGENDARY: 5.0 } }
    },

    TIERS: {
        COMMON: {
            id: 1,
            type: 'Common',
            value: 0,
            burnReward: 8,
            players: [
                { name: 'Rotation Player #7', nation: 'ENG', number: 7, primary: '#ffffff', secondary: '#cf081f' },
                { name: 'Rotation Player #11', nation: 'ESP', number: 11, primary: '#aa1515', secondary: '#f1bf00' },
                { name: 'Rotation Player #9', nation: 'GER', number: 9, primary: '#ffffff', secondary: '#000000' },
                { name: 'Rotation Player #4', nation: 'ITA', number: 4, primary: '#009246', secondary: '#ce2b37' }
            ]
        },
        RARE: {
            id: 2,
            type: 'Rare',
            value: 0,
            burnReward: 40,
            players: [
                { name: 'Enzo Fernandez', nation: 'ARG', number: 24, primary: '#75aadb', secondary: '#ffffff' },
                { name: 'Son Heung-min', nation: 'KOR', number: 7, primary: '#cd2e3a', secondary: '#0047a0' },
                { name: 'Achraf Hakimi', nation: 'MAR', number: 2, primary: '#c1272d', secondary: '#006233' },
                { name: 'Cody Gakpo', nation: 'NED', number: 11, primary: '#ff6600', secondary: '#21468b' }
            ]
        },
        EPIC: {
            id: 3,
            type: 'Epic',
            value: 0.5,
            burnReward: 150,
            players: [
                { name: 'Arda Guler', nation: 'TUR', number: 10, primary: '#e30a17', secondary: '#ffffff' },
                { name: 'Jude Bellingham', nation: 'ENG', number: 10, primary: '#ffffff', secondary: '#cf081f' },
                { name: 'Jamal Musiala', nation: 'GER', number: 10, primary: '#ffffff', secondary: '#000000' },
                { name: 'Kevin De Bruyne', nation: 'BEL', number: 7, primary: '#000000', secondary: '#fdda24' }
            ]
        },
        LEGENDARY: {
            id: 4,
            type: 'Legendary',
            value: 5.0,
            burnReward: 0,
            players: [
                { name: 'Lionel Messi', nation: 'ARG', number: 10, primary: '#75aadb', secondary: '#ffffff' },
                { name: 'Cristiano Ronaldo', nation: 'POR', number: 7, primary: '#006600', secondary: '#ff0000' },
                { name: 'Kylian Mbappe', nation: 'FRA', number: 10, primary: '#002395', secondary: '#ed2939' },
                { name: 'Pele', nation: 'BRA', number: 10, primary: '#009c3b', secondary: '#ffdf00' }
            ]
        }
    }
};
