// commands/countstats.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const CountingStats = require('../models/CountingStats');
const CountingState = require('../models/CountingState');
const { TOKEN_EVERY, MAX_TOKENS } = require('../events/countingGame');

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
        .setDescription('Show the top counters in the server'))
    .addSubcommand(sub =>
      sub.setName('ruiners')
        .setDescription('Show who has ruined the count the most')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    const allStats = await CountingStats.find({});
    const totalCorrectAllUsers = allStats.reduce((sum, s) => sum + s.correctCount, 0);

    if (subcommand === 'me') {
      const stats = await CountingStats.findOne({ userId: interaction.user.id });

      if (!stats || (stats.correctCount === 0 && (stats.ruinCount || 0) === 0)) {
        return interaction.reply({
          content: `You haven't counted anything yet — go count something! 🔢`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const ruinCount = stats.ruinCount || 0;
      const attempts = stats.correctCount + ruinCount;
      const ruinRate = attempts > 0 ? ((ruinCount / attempts) * 100).toFixed(1) : '0.0';
      const percentage = totalCorrectAllUsers > 0
        ? ((stats.correctCount / totalCorrectAllUsers) * 100).toFixed(1)
        : '0.0';

      const tokens = stats.saveTokens || 0;
      const untilNextToken = TOKEN_EVERY - (stats.correctCount % TOKEN_EVERY);
      const tokenValue = tokens >= MAX_TOKENS
        ? `${tokens}/${MAX_TOKENS} (full)`
        : `${tokens}/${MAX_TOKENS}\nNext in ${untilNextToken}`;

      const embed = new EmbedBuilder()
        .setTitle('🔢 Counting Stats')
        .setColor(0x5865F2)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setDescription(`Stats for **${interaction.user.username}**`)
        .addFields(
          { name: '✅ Correct Counts', value: `${stats.correctCount}`, inline: true },
          { name: '📊 Server Share', value: `${percentage}%`, inline: true },
          { name: '🛡️ Save Tokens', value: tokenValue, inline: true },
          { name: '🔥 Current Streak', value: `${stats.currentStreak}`, inline: true },
          { name: '🏆 Best Streak', value: `${stats.bestStreak}`, inline: true },
          { name: '💥 Counts Ruined', value: `${ruinCount} (${ruinRate}%)`, inline: true },
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

      const state = await CountingState.findById('counting_state');
      const header = state
        ? `Next number: **${state.currentCount}** • Server record: **${state.highScore || 0}**\n\n`
        : '';

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
        .setDescription(header + lines.join('\n'))
        .setFooter({ text: 'Kavià Fun Bot • Counting Game' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'ruiners') {
      const ruiners = allStats
        .filter(s => (s.ruinCount || 0) > 0)
        .sort((a, b) => b.ruinCount - a.ruinCount)
        .slice(0, 10);

      if (ruiners.length === 0) {
        return interaction.reply(`Nobody has ruined the count yet. Suspicious.`);
      }

      const lines = ruiners.map((s, i) => {
        const attempts = s.correctCount + s.ruinCount;
        const rate = ((s.ruinCount / attempts) * 100).toFixed(1);
        const rankLabel = MEDALS[i] || `**${i + 1}.**`;
        return `${rankLabel} <@${s.userId}> — **${s.ruinCount}** ruined (${rate}% of their attempts)`;
      });

      const embed = new EmbedBuilder()
        .setTitle('💥 Count Ruiners')
        .setColor(0xE74C3C)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Kavià Fun Bot • Counting Game' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};