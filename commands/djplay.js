// commands/djplay.js
// Toggles auto-DJ mode PERSISTENTLY for this server - once turned on, it
// stays on for every future /play, no need to run this every time.

const { SlashCommandBuilder } = require('discord.js');
const { useQueue, QueueRepeatMode } = require('discord-player');
const GuildSettings = require('../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('djplay')
    .setDescription('Toggle auto-DJ mode for this server (bot keeps queuing similar songs automatically)'),

  async execute(interaction) {
    let settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
    if (!settings) {
      settings = await GuildSettings.create({ guildId: interaction.guild.id });
    }

    settings.autoDjEnabled = !settings.autoDjEnabled;
    await settings.save();

    // If music is currently playing, apply the change immediately too
    const queue = useQueue(interaction.guild.id);
    if (queue && queue.currentTrack) {
      queue.setRepeatMode(settings.autoDjEnabled ? QueueRepeatMode.AUTOPLAY : QueueRepeatMode.OFF);
    }

    await interaction.reply(
      settings.autoDjEnabled
        ? `🎧 Auto-DJ turned **on** for this server — I'll keep queuing similar songs from now on, every time.`
        : `🎧 Auto-DJ turned **off** for this server.`
    );
  },
};