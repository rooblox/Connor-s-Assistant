// models/CountingState.js
// There's only ever ONE document in this collection - it just tracks
// where the count currently is, so the bot remembers after a restart.

const mongoose = require('mongoose');

const countingStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'counting_state' }, // fixed ID, always the same doc
  currentCount: { type: Number, default: 1 },
  lastUserId: { type: String, default: null },
});

module.exports = mongoose.model('CountingState', countingStateSchema);
