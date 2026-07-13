// commands/queue.js
// Shows what's currently playing and what's up next.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),

  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: `Nothing is playing right now.`, ephemeral: true });
    }

    const upcoming = queue.tracks.toArray().slice(0, 10);
    const upcomingList = upcoming.length > 0
      ? upcoming.map((t, i) => `**${i + 1}.** ${t.title} — ${t.author}`).join('\n')
      : '*Queue is empty — nothing up next.*';

    const embed = new EmbedBuilder()
      .setTitle('🎶 Music Queue')
      .setColor(0x5865F2)
      .addFields(
        { name: 'Now Playing', value: `**${queue.currentTrack.title}** — ${queue.currentTrack.author}` },
        { name: `Up Next (${queue.tracks.size} total)`, value: upcomingList },
      );

    await interaction.reply({ embeds: [embed] });
  },
};