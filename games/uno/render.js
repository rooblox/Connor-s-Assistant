// games/uno/render.js
// Builds the embeds/components shown for the Uno game state.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { cardLabel, COLOR_EMOJI } = require('./deck');
const gameManager = require('./gameManager');

function renderLobbyEmbed(game) {
  const playerList = game.players.map(p => `• ${p.username}`).join('\n');
  const modeLabel = game.mode === 'intense' ? '🔥 Intense (stacking, 7-0 rule, 30s turns)' : 'Classic';
  return new EmbedBuilder()
    .setTitle('🎴 Uno Lobby')
    .setColor(0xE74C3C)
    .setDescription(`Mode: **${modeLabel}**\n\nClick **Join** to play. The host can **Manage Players** to kick anyone, then hit **Start Game** (2-6 players) - a private game channel will be created for whoever's still in.\n\n**Players (${game.players.length}/6):**\n${playerList}`);
}

function renderLobbyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('uno_join').setLabel('Join').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('uno_manage').setLabel('Manage Players').setEmoji('🔧').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('uno_start').setLabel('Start Game').setEmoji('▶️').setStyle(ButtonStyle.Primary),
  );
}

function renderKickSelect(game, hostId) {
  const kickable = game.players.filter(p => p.id !== hostId);
  if (kickable.length === 0) return null;

  const options = kickable.map(p => ({ label: p.username, value: p.id }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('uno_kick_select')
      .setPlaceholder('Choose a player to remove')
      .addOptions(options),
  );
}

function renderGameEmbed(game) {
  const topCard = game.discardPile[game.discardPile.length - 1];
  const current = gameManager.currentPlayer(game);
  const colorEmoji = COLOR_EMOJI[game.currentColor];
  const timeoutSeconds = game.mode === 'intense' ? 30 : 60;

  const playerList = game.players
    .map((p, i) => {
      const turnMarker = i === game.currentPlayerIndex ? '👉 ' : '';
      const unoWarning = game.pendingUnoCallerId === p.id ? ' 🚨 UNO!' : '';
      return `${turnMarker}${p.username} — ${p.hand.length} card${p.hand.length === 1 ? '' : 's'}${unoWarning}`;
    })
    .join('\n');

  let description = `**Current card:** ${cardLabel(topCard)}\n**Color in play:** ${colorEmoji}`;
  if (game.pendingDrawStack) {
    const stackLabel = game.pendingDrawStack.type === 'drawTwo' ? 'Draw Two' : 'Wild Draw Four';
    description += `\n🥞 **Draw stack: ${game.pendingDrawStack.amount}** (${stackLabel}) - stack or draw!`;
  }
  description += `\n\n**It's ${current.username}'s turn!** (${timeoutSeconds}s to act)`;

  return new EmbedBuilder()
    .setTitle(`🎴 Uno${game.mode === 'intense' ? ' 🔥 Intense' : ''}`)
    .setColor(0xE74C3C)
    .setDescription(description)
    .addFields({ name: 'Players', value: playerList })
    .setFooter({ text: `Click "My Hand" below to view your cards and play.` });
}

function renderGameRow(game) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('uno_hand').setLabel('My Hand').setEmoji('🃏').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('uno_draw').setLabel('Draw Card').setEmoji('➕').setStyle(ButtonStyle.Secondary),
  );

  if (game.pendingUnoCallerId) {
    row.addComponents(
      new ButtonBuilder().setCustomId('uno_calluno').setLabel('Call UNO!').setEmoji('📢').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('uno_catch').setLabel('Catch Them!').setEmoji('😤').setStyle(ButtonStyle.Danger),
    );
  }

  return row;
}

function renderHandComponents(player) {
  if (player.hand.length === 0) return [];

  const options = player.hand.slice(0, 25).map(card => ({
    label: cardLabel(card),
    value: card.uid,
  }));

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('uno_selectcard')
      .setPlaceholder('Choose a card to play')
      .addOptions(options),
  );

  return [selectRow];
}

function renderColorChoiceRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('uno_color_red').setLabel('Red').setEmoji('🔴').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('uno_color_blue').setLabel('Blue').setEmoji('🔵').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('uno_color_green').setLabel('Green').setEmoji('🟢').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('uno_color_yellow').setLabel('Yellow').setEmoji('🟡').setStyle(ButtonStyle.Secondary),
  );
}

function renderPlayAgainRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('uno_playagain').setLabel('Play Again').setEmoji('🔁').setStyle(ButtonStyle.Success),
  );
}

function renderSevenSwapSelect(game, currentUserId) {
  const others = game.players.filter(p => p.id !== currentUserId);
  if (others.length === 0) return null;

  const options = others.map(p => ({ label: p.username, value: p.id }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('uno_seven_select')
      .setPlaceholder('Choose who to swap hands with')
      .addOptions(options),
  );
}

module.exports = {
  renderLobbyEmbed,
  renderLobbyRow,
  renderKickSelect,
  renderGameEmbed,
  renderGameRow,
  renderHandComponents,
  renderColorChoiceRow,
  renderPlayAgainRow,
  renderSevenSwapSelect,
};