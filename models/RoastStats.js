// models/RoastStats.js
// Tracks how many times each user has been roasted by the bot (via
// -roast command or "@bot roast @user"), for the /beefboard leaderboard.

const mongoose = require('mongoose');

const roastStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  roastCount: { type: Number, default: 0 },
});

module.exports = mongoose.model('RoastStats', roastStatsSchema);