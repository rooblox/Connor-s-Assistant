// models/CountingStats.js
// One document per user. Tracks their all-time counting stats.

const mongoose = require('mongoose');

const countingStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  correctCount: { type: Number, default: 0 },   // total correct counts, all-time
  currentStreak: { type: Number, default: 0 },  // personal streak (resets when THEY mess up)
  bestStreak: { type: Number, default: 0 },     // best-ever personal streak
  ruinCount: { type: Number, default: 0 },      // times they busted the count
  saveTokens: { type: Number, default: 0 },     // Save Tokens currently held
});

module.exports = mongoose.model('CountingStats', countingStatsSchema);