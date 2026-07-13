// commands/volume.js
const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume (0-100)')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('Volume level, 0-100')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)),

  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: `Nothing is playing right now.`, ephemeral: true });
    }

    const level = interaction.options.getInteger('level');
    queue.node.setVolume(level);
    await interaction.reply(`🔊 Volume set to **${level}%**.`);
  },
};