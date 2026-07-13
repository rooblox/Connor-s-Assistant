// models/CountingStats.js
// One document per user. Tracks their all-time correct counts and streaks.

const mongoose = require('mongoose');

const countingStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  correctCount: { type: Number, default: 0 },   // total correct counts, all-time
  currentStreak: { type: Number, default: 0 },  // their current personal streak (resets when THEY mess up)
  bestStreak: { type: Number, default: 0 },     // their best-ever personal streak
});

module.exports = mongoose.model('CountingStats', countingStatsSchema);
