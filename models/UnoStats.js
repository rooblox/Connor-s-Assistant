// models/UnoStats.js
// Tracks Uno wins per user for the leaderboard.

const mongoose = require('mongoose');

const unoStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  wins: { type: Number, default: 0 },
});

module.exports = mongoose.model('UnoStats', unoStatsSchema);