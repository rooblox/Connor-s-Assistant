// models/CountingState.js
// There's only ever ONE document in this collection - it tracks where the
// count currently is, the server record, and who contributed to this run.

const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema(
  { userId: String, count: Number },
  { _id: false }
);

const countingStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'counting_state' }, // fixed ID, always the same doc
  currentCount: { type: Number, default: 1 },        // the NEXT number someone needs to say
  lastUserId: { type: String, default: null },
  lastMessageId: { type: String, default: null },    // last CORRECT count message, used to catch deletes/edits
  highScore: { type: Number, default: 0 },           // highest number any run has reached
  runContributions: { type: [contributionSchema], default: [] }, // per-user counts in the current run
});

module.exports = mongoose.model('CountingState', countingStateSchema);