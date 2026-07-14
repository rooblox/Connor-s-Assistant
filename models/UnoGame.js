// models/UnoGame.js
// Tracks Uno game channels so we can auto-delete them after 24 hours if
// a game never finishes. Actual live game state (hands, deck, turns) is
// kept in memory (games/uno/gameManager.js) since it changes constantly -
// this DB record is just for cleanup bookkeeping.

const mongoose = require('mongoose');

const unoGameSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  status: { type: String, enum: ['lobby', 'active', 'finished'], default: 'lobby' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UnoGame', unoGameSchema);