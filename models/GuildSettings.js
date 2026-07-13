// models/GuildSettings.js
// Stores per-server settings that should persist across bot restarts,
// like whether auto-DJ mode is enabled.

const mongoose = require('mongoose');

const guildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  autoDjEnabled: { type: Boolean, default: false },
});

module.exports = mongoose.model('GuildSettings', guildSettingsSchema);