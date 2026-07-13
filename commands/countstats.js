// commands/countstats.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CountingStats = require('../models/CountingStats');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countstats')
    .setDescription('Show counting game stats')
    .addSubcommand(sub =>
      sub.setName('me')
        .setDescription('Show your own counting stats'))
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('Show the top counters in the server')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    const allStats = await CountingStats.find({});
    const totalCorrectAllUsers = allStats.reduce((sum, s) => sum + s.correctCount, 0);

    if (subcommand === 'me') {
      const stats = await CountingStats.findOne({ userId: interaction.user.id });

      if (!stats || stats.correctCount === 0) {
        return interaction.reply({
          content: `You haven't gotten any correct counts yet — go count something! 🔢`,
          ephemeral: true,
        });
      }

      const percentage = totalCorrectAllUsers > 0
        ? ((stats.correctCount / totalCorrectAllUsers) * 100).toFixed(1)
        : '0.0';

      const embed = new EmbedBuilder()
        .setTitle('🔢 Counting Stats')
        .setColor(0x5865F2)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setDescription(`Stats for **${interaction.user.username}**`)
        .addFields(
          { name: '✅ Correct Counts', value: `${stats.correctCount}`, inline: true },
          { name: '📊 Server Share', value: `${percentage}%`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '🔥 Current Streak', value: `${stats.currentStreak}`, inline: true },
          { name: '🏆 Best Streak', value: `${stats.bestStreak}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
        )
        .setFooter({ text: 'Kavià Fun Bot • Counting Game' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'leaderboard') {
      const top = allStats
        .sort((a, b) => b.correctCount - a.correctCount)
        .slice(0, 10);

      if (top.length === 0) {
        return interaction.reply(`No one has counted anything yet!`);
      }

      const lines = top.map((s, i) => {
        const percentage = totalCorrectAllUsers > 0
          ? ((s.correctCount / totalCorrectAllUsers) * 100).toFixed(1)
          : '0.0';
        const rankLabel = MEDALS[i] || `**${i + 1}.**`;
        return `${rankLabel} <@${s.userId}> — **${s.correctCount}** correct (${percentage}%) · best streak **${s.bestStreak}**`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🔢 Counting Leaderboard')
        .setColor(0x5865F2)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Kavià Fun Bot • Counting Game' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};