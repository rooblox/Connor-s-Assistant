// commands/stop.js
const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue'),

  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: `Nothing is playing right now.`, ephemeral: true });
    }

    queue.delete();
    await interaction.reply(`⏹️ Stopped playback and cleared the queue.`);
  },
};