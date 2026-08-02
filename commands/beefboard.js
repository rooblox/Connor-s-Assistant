// commands/beefboard.js
// Shows the leaderboard of who's been roasted the most by the bot.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const RoastStats = require('../models/RoastStats');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('beefboard')
    .setDescription('See who has been roasted the most by the bot'),

  async execute(interaction) {
    const top = await RoastStats.find({}).sort({ roastCount: -1 }).limit(10);

    if (top.length === 0) {
      return interaction.reply(`Nobody's been roasted yet. Give it time.`);
    }

    const lines = top.map((entry, i) => {
      const rankLabel = MEDALS[i] || `**${i + 1}.**`;
      return `${rankLabel} <@${entry.userId}> — **${entry.roastCount}** roast${entry.roastCount === 1 ? '' : 's'}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🔥 Beef Board')
      .setColor(0xE74C3C)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Roasted via -roast or asking the bot to roast someone` });

    await interaction.reply({ embeds: [embed] });
  },
};