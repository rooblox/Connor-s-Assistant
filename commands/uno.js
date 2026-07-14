// commands/uno.js
// Starts a new Uno lobby: creates a dedicated channel, posts a join
// screen, and tracks it in Mongo so it can be auto-cleaned up later.

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const UnoGame = require('../models/UnoGame');
const gameManager = require('../games/uno/gameManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uno')
    .setDescription('Start a game of Uno'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const shortId = Math.random().toString(36).slice(2, 8);
    const channelName = `uno-${shortId}`;

    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: `Uno game started by ${interaction.user.username}`,
    });

    await UnoGame.create({
      channelId: channel.id,
      guildId: interaction.guild.id,
      status: 'lobby',
    });

    const game = gameManager.createGame(channel.id, interaction.guild.id, interaction.user.id);
    gameManager.addPlayer(game, interaction.user.id, interaction.user.username);

    const embed = new EmbedBuilder()
      .setTitle('🎴 Uno Lobby')
      .setColor(0xE74C3C)
      .setDescription(`${interaction.user.username} started a game! Click **Join** to play.\n\n**Players (1/6):**\n• ${interaction.user.username}`)
      .setFooter({ text: `This channel auto-deletes after 24 hours if the game never finishes.` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('uno_join').setLabel('Join').setEmoji('➕').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('uno_start').setLabel('Start Game').setEmoji('▶️').setStyle(ButtonStyle.Primary),
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply(`Game channel created: ${channel}`);
  },
};