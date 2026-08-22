// commands/unostats.js
// Shows the Uno wins leaderboard.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UnoStats = require('../models/UnoStats');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unostats')
    .setDescription('See the Uno wins leaderboard'),

  async execute(interaction) {
    const top = await UnoStats.find({}).sort({ wins: -1 }).limit(10);

    if (top.length === 0) {
      return interaction.reply(`Nobody's won a game of Uno yet — start one with /uno!`);
    }

    const lines = top.map((entry, i) => {
      const rankLabel = MEDALS[i] || `**${i + 1}.**`;
      return `${rankLabel} <@${entry.userId}> — **${entry.wins}** win${entry.wins === 1 ? '' : 's'}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🎴 Uno Leaderboard')
      .setColor(0xE74C3C)
      .setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed] });
  },
};