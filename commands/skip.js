// commands/skip.js
const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: `Nothing is playing right now.`, ephemeral: true });
    }

    const skippedTrack = queue.currentTrack;
    queue.node.skip();
    await interaction.reply(`⏭️ Skipped **${skippedTrack.title}**.`);
  },
};