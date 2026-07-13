// commands/play.js
// Plays a song from a YouTube link or search term, and shows a
// "now playing" embed with a DJ control panel underneath.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { buildControlRow } = require('../music/controlPanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube (link or search term)')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('YouTube link or search term')
        .setRequired(true)),

  async execute(interaction) {
    const query = interaction.options.getString('query');
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: `You need to be in a voice channel for me to play music!`,
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const player = useMainPlayer();

    try {
      const { track, queue } = await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: {
            channel: interaction.channel,
          },
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 60_000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 60_000,
        },
      });

      const embed = new EmbedBuilder()
        .setTitle('🎵 Added to Queue')
        .setColor(0x5865F2)
        .setDescription(`**${track.title}**\nby ${track.author}`)
        .setThumbnail(track.thumbnail)
        .setFooter({ text: `Requested by ${interaction.user.username}` });

      const controlRow = buildControlRow(queue);

      await interaction.editReply({ embeds: [embed], components: [controlRow] });
    } catch (error) {
      console.error('[play] Failed to play track:', error);
      await interaction.editReply(`Couldn't play that — try a different link or search term.`);
    }
  },
};