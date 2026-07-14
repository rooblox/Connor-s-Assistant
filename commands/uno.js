// commands/uno.js
// Posts a join lobby in the CURRENT channel. Players join here. Once the
// host starts the game (or kicks people first), a private game channel
// gets created with only the confirmed players able to see it.

const { SlashCommandBuilder } = require('discord.js');
const gameManager = require('../games/uno/gameManager');
const { renderLobbyEmbed, renderLobbyRow } = require('../games/uno/render');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uno')
    .setDescription('Start a game of Uno'),

  async execute(interaction) {
    const existing = gameManager.getGame(interaction.channel.id);
    if (existing) {
      return interaction.reply({ content: `There's already an active Uno lobby/game in this channel.`, ephemeral: true });
    }

    const game = gameManager.createGame(interaction.channel.id, interaction.guild.id, interaction.user.id);
    gameManager.addPlayer(game, interaction.user.id, interaction.user.username);

    await interaction.reply({
      embeds: [renderLobbyEmbed(game)],
      components: [renderLobbyRow()],
    });

    const message = await interaction.fetchReply();
    game.publicMessageId = message.id;
  },
};