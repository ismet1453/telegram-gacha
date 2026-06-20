const mongoose = require('mongoose');

const matchPredictionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    teamA: { type: String, required: true },
    teamB: { type: String, required: true },
    matchDate: { type: String, required: true },
    active: { type: Boolean, default: true },
    result: { type: String, enum: ['pending', 'teamA', 'teamB', 'draw'], default: 'pending' },
    votes: {
        teamA: { type: Number, default: 0 },
        teamB: { type: Number, default: 0 },
        draw: { type: Number, default: 0 }
    }
}, { timestamps: true });

module.exports = mongoose.model('MatchPrediction', matchPredictionSchema);
