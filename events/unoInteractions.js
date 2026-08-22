// events/unoInteractions.js
// Handles all Uno button/select-menu interactions: join, manage/kick,
// start, view hand, play a card, draw a card, choose a wild color,
// call/catch UNO, 7-swap (Intense mode), and play again. Runs the turn timer.

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const gameManager = require('../games/uno/gameManager');
const UnoGame = require('../models/UnoGame');
const UnoStats = require('../models/UnoStats');
const {
  renderLobbyEmbed, renderLobbyRow, renderKickSelect,
  renderGameEmbed, renderGameRow,
  renderHandComponents, renderColorChoiceRow, renderPlayAgainRow, renderSevenSwapSelect,
} = require('../games/uno/render');

async function updateLobbyMessage(interaction, game) {
  if (!game.publicMessageId) return;
  const message = await interaction.channel.messages.fetch(game.publicMessageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [renderLobbyEmbed(game)], components: [renderLobbyRow()] });
}

async function updateGameMessage(channel, game) {
  if (!game.publicMessageId) return;
  const message = await channel.messages.fetch(game.publicMessageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [renderGameEmbed(game)], components: [renderGameRow(game)] });
}

function armTurnTimer(channel, game) {
  gameManager.scheduleTurnTimeout(game, async () => {
    if (game.status !== 'active') return;
    const skippedPlayer = gameManager.currentPlayer(game);
    gameManager.drawCardForCurrentPlayer(game);
    await channel.send(`⏱️ ${skippedPlayer.username} took too long — drew a card and their turn was skipped.`).catch(() => {});
    await updateGameMessage(channel, game);
    armTurnTimer(channel, game);
  });
}

async function handleUnoInteraction(interaction) {
  const channelId = interaction.channel.id;
  const game = gameManager.getGame(channelId);

  if (!game) {
    return interaction.reply({ content: `This game no longer exists.`, ephemeral: true });
  }

  const customId = interaction.customId;

  // --- Join ---
  if (customId === 'uno_join') {
    if (game.status !== 'lobby') {
      return interaction.reply({ content: `This game has already started.`, ephemeral: true });
    }
    if (game.players.length >= 6) {
      return interaction.reply({ content: `This lobby is full (6 players max).`, ephemeral: true });
    }
    const added = gameManager.addPlayer(game, interaction.user.id, interaction.user.username);
    if (!added) {
      return interaction.reply({ content: `You're already in this game!`, ephemeral: true });
    }
    await interaction.reply({ content: `You joined the game!`, ephemeral: true });
    await updateLobbyMessage(interaction, game);
    return;
  }

  // --- Manage players (host only) ---
  if (customId === 'uno_manage') {
    if (interaction.user.id !== game.hostId) {
      return interaction.reply({ content: `Only the host can manage players.`, ephemeral: true });
    }
    const row = renderKickSelect(game, game.hostId);
    if (!row) {
      return interaction.reply({ content: `No other players to remove yet.`, ephemeral: true });
    }
    return interaction.reply({ content: `Select a player to remove:`, components: [row], ephemeral: true });
  }

  // --- Kick selection ---
  if (customId === 'uno_kick_select') {
    if (interaction.user.id !== game.hostId) {
      return interaction.reply({ content: `Only the host can do this.`, ephemeral: true });
    }
    const kickedId = interaction.values[0];
    game.players = game.players.filter(p => p.id !== kickedId);
    await interaction.update({ content: `Player removed.`, components: [] });
    await updateLobbyMessage(interaction, game);
    return;
  }

  // --- Start (creates the private game channel) ---
  if (customId === 'uno_start') {
    if (game.status !== 'lobby') {
      return interaction.reply({ content: `Game already started.`, ephemeral: true });
    }
    if (interaction.user.id !== game.hostId) {
      return interaction.reply({ content: `Only the host who started the lobby can start it.`, ephemeral: true });
    }
    if (game.players.length < 2) {
      return interaction.reply({ content: `Need at least 2 players to start.`, ephemeral: true });
    }

    await interaction.deferUpdate();

    const guild = interaction.guild;
    const shortId = Math.random().toString(36).slice(2, 8);

    const permissionOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...game.players.map(p => ({
        id: p.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      })),
      {
        id: interaction.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
      },
    ];

    const gameChannel = await guild.channels.create({
      name: `uno-${shortId}`,
      type: ChannelType.GuildText,
      topic: `Uno game - players only`,
      permissionOverwrites,
    });

    await UnoGame.create({ channelId: gameChannel.id, guildId: guild.id, status: 'active' });

    gameManager.deleteGame(channelId);
    game.channelId = gameChannel.id;
    gameManager.games.set(gameChannel.id, game);

    gameManager.startGame(game);

    const mentions = game.players.map(p => `<@${p.id}>`).join(' ');
    const gameMessage = await gameChannel.send({ content: mentions, embeds: [renderGameEmbed(game)], components: [renderGameRow(game)] });
    game.publicMessageId = gameMessage.id;

    armTurnTimer(gameChannel, game);

    if (game.publicMessageId) {
      const oldLobbyMessage = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
      if (oldLobbyMessage) {
        await oldLobbyMessage.edit({ content: `🎴 Game started! Head to ${gameChannel}`, embeds: [], components: [] });
      }
    }
    return;
  }

  // --- View hand ---
  if (customId === 'uno_hand') {
    if (game.status !== 'active') {
      return interaction.reply({ content: `Game hasn't started yet.`, ephemeral: true });
    }
    const player = game.players.find(p => p.id === interaction.user.id);
    if (!player) {
      return interaction.reply({ content: `You're not in this game.`, ephemeral: true });
    }
    const components = renderHandComponents(player);
    if (components.length === 0) {
      return interaction.reply({ content: `You have no cards!`, ephemeral: true });
    }
    return interaction.reply({ content: `Your hand:`, components, ephemeral: true });
  }

  // --- Draw a card ---
  if (customId === 'uno_draw') {
    if (game.status !== 'active') {
      return interaction.reply({ content: `Game hasn't started yet.`, ephemeral: true });
    }
    const current = gameManager.currentPlayer(game);
    if (current.id !== interaction.user.id) {
      return interaction.reply({ content: `It's not your turn!`, ephemeral: true });
    }
    gameManager.drawCardForCurrentPlayer(game);
    await interaction.reply({ content: `You drew a card. Turn passed to the next player.`, ephemeral: true });
    await updateGameMessage(interaction.channel, game);
    armTurnTimer(interaction.channel, game);
    return;
  }

  // --- Call UNO! (self) ---
  if (customId === 'uno_calluno') {
    const called = gameManager.callUno(game, interaction.user.id);
    if (!called) {
      return interaction.reply({ content: `You don't have a pending UNO call.`, ephemeral: true });
    }
    await interaction.reply({ content: `📢 UNO called! You're safe.` });
    await updateGameMessage(interaction.channel, game);
    return;
  }

  // --- Catch someone who forgot to call UNO ---
  if (customId === 'uno_catch') {
    const offender = gameManager.catchUnoFailure(game);
    if (!offender) {
      return interaction.reply({ content: `Nobody to catch right now.`, ephemeral: true });
    }
    await interaction.reply(`😤 ${interaction.user.username} caught ${offender.username} not calling UNO! They draw 2 penalty cards.`);
    await updateGameMessage(interaction.channel, game);
    return;
  }

  // --- Selecting a card from the hand dropdown ---
  if (customId === 'uno_selectcard') {
    if (game.status !== 'active') {
      return interaction.reply({ content: `Game hasn't started yet.`, ephemeral: true });
    }
    const current = gameManager.currentPlayer(game);
    if (current.id !== interaction.user.id) {
      return interaction.reply({ content: `It's not your turn!`, ephemeral: true });
    }
    const player = game.players.find(p => p.id === interaction.user.id);
    const cardUid = interaction.values[0];

    const result = gameManager.playCard(game, player, cardUid);

    if (!result.success && result.needsColor) {
      game.pendingWild = { userId: interaction.user.id, cardUid };
      return interaction.update({ content: `Choose a color for your wild card:`, components: [renderColorChoiceRow()] });
    }
    if (!result.success) {
      return interaction.reply({ content: result.message, ephemeral: true });
    }

    if (result.winner) {
      await interaction.update({ content: `🎉 You won!`, components: [] });
      return handleGameOver(interaction.channel, game, result.winner);
    }

    if (result.needsSevenSwap) {
      const swapRow = renderSevenSwapSelect(game, interaction.user.id);
      await interaction.update({ content: result.message, components: swapRow ? [swapRow] : [] });
      await updateGameMessage(interaction.channel, game);
      armTurnTimer(interaction.channel, game);
      return;
    }

    await interaction.update({ content: `Card played! ${result.message || ''}`, components: [] });
    await updateGameMessage(interaction.channel, game);
    armTurnTimer(interaction.channel, game);
    return;
  }

  // --- 7-swap target selection (Intense mode) ---
  if (customId === 'uno_seven_select') {
    const targetId = interaction.values[0];
    const swapResult = gameManager.performSevenSwap(game, interaction.user.id, targetId);
    if (!swapResult) {
      return interaction.update({ content: `That swap didn't work.`, components: [] });
    }
    await interaction.update({ content: `🔀 ${swapResult.fromPlayer.username} swapped hands with ${swapResult.toPlayer.username}!`, components: [] });
    await updateGameMessage(interaction.channel, game);
    return;
  }

  // --- Color choice for wild cards ---
  if (customId.startsWith('uno_color_')) {
    if (!game.pendingWild || game.pendingWild.userId !== interaction.user.id) {
      return interaction.reply({ content: `No pending wild card for you.`, ephemeral: true });
    }
    const chosenColor = customId.replace('uno_color_', '');
    const player = game.players.find(p => p.id === interaction.user.id);
    const result = gameManager.playCard(game, player, game.pendingWild.cardUid, chosenColor);
    game.pendingWild = null;

    if (!result.success) {
      return interaction.update({ content: result.message, components: [] });
    }

    if (result.winner) {
      await interaction.update({ content: `🎉 You won!`, components: [] });
      return handleGameOver(interaction.channel, game, result.winner);
    }

    await interaction.update({ content: `Card played! ${result.message || ''}`, components: [] });
    await updateGameMessage(interaction.channel, game);
    armTurnTimer(interaction.channel, game);
    return;
  }

  // --- Play again ---
  if (customId === 'uno_playagain') {
    if (game.status !== 'finished') {
      return interaction.reply({ content: `This game isn't over yet.`, ephemeral: true });
    }
    if (game.deletionTimer) {
      clearTimeout(game.deletionTimer);
      game.deletionTimer = null;
    }

    await interaction.deferUpdate();

    gameManager.startGame(game);
    await UnoGame.findOneAndUpdate({ channelId: game.channelId }, { status: 'active' });

    const gameMessage = await interaction.channel.send({ embeds: [renderGameEmbed(game)], components: [renderGameRow(game)] });
    game.publicMessageId = gameMessage.id;
    armTurnTimer(interaction.channel, game);
    return;
  }
}

async function handleGameOver(channel, game, winner) {
  gameManager.clearTurnTimer(game);

  if (game.publicMessageId) {
    const message = await channel.messages.fetch(game.publicMessageId).catch(() => null);
    if (message) {
      await message.edit({
        content: `🎉 **${winner.username} won the game!**`,
        embeds: [],
        components: [renderPlayAgainRow()],
      });
    }
  }

  await UnoGame.findOneAndUpdate({ channelId: game.channelId }, { status: 'finished' });
  await UnoStats.findOneAndUpdate({ userId: winner.id }, { $inc: { wins: 1 } }, { upsert: true });

  game.deletionTimer = setTimeout(async () => {
    gameManager.deleteGame(game.channelId);
    await channel.delete().catch(() => {});
  }, 60_000);
}

module.exports = { handleUnoInteraction };