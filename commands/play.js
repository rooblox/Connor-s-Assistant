// commands/play.js
// Plays a song from a search term (searches SoundCloud - free, reliable,
// no API key needed) or a direct SoundCloud/YouTube link.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useMainPlayer, QueueRepeatMode, QueryType } = require('discord-player');
const { buildControlRow } = require('../music/controlPanel');
const GuildSettings = require('../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song (search term or link)')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Search term, or a SoundCloud/YouTube link')
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
        searchEngine: QueryType.SOUNDCLOUD_SEARCH,
        nodeOptions: {
          metadata: {
            channel: interaction.channel,
          },
          debug: true,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 60_000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 60_000,
        },
      });

      const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
      if (settings?.autoDjEnabled) {
        queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
      }

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
      await interaction.editReply(`Couldn't play that — try a different search term or link.`);
    }
  },
};