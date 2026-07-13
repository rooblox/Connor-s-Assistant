// commands/musicpanel.js
// Shows a full music control panel: now playing info + all the control
// buttons in one place, so you don't need separate commands for everything.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { buildControlRow } = require('../music/controlPanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('musicpanel')
    .setDescription('Show the music control panel'),

  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);

    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: `Nothing is playing right now — use \`/play\` to start something!`, ephemeral: true });
    }

    const track = queue.currentTrack;
    const upcoming = queue.tracks.toArray().slice(0, 5);
    const upcomingList = upcoming.length > 0
      ? upcoming.map((t, i) => `**${i + 1}.** ${t.title}`).join('\n')
      : '*Nothing queued up next.*';

    const isPaused = queue.node.isPaused();
    const isLooping = queue.repeatMode !== 0;

    const embed = new EmbedBuilder()
      .setTitle('🎛️ Music Control Panel')
      .setColor(0x5865F2)
      .setThumbnail(track.thumbnail)
      .addFields(
        { name: 'Now Playing', value: `**${track.title}**\nby ${track.author}` },
        { name: 'Status', value: `${isPaused ? '⏸️ Paused' : '▶️ Playing'} • ${isLooping ? '🔁 Looping' : 'No loop'} • 🔊 ${queue.node.volume}%`, inline: false },
        { name: `Up Next (${queue.tracks.size} total)`, value: upcomingList },
      )
      .setFooter({ text: 'Use the buttons below to control playback' });

    const controlRow = buildControlRow(queue);

    await interaction.reply({ embeds: [embed], components: [controlRow] });
  },
};