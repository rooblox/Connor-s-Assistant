// games/uno/render.js
// Builds the embeds/components shown for the Uno game state.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { cardLabel, COLOR_EMOJI } = require('./deck');
const gameManager = require('./gameManager');

function renderLobbyEmbed(game) {
  const playerList = game.players.map(p => `• ${p.username}`).join('\n');
  return new EmbedBuilder()
    .setTitle('🎴 Uno Lobby')
    .setColor(0xE74C3C)
    .setDescription(`Click **Join** to play. The host can **Manage Players** to kick anyone, then hit **Start Game** (2-6 players) - a private game channel will be created for whoever's still in.\n\n**Players (${game.players.length}/6):**\n${playerList}`);
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

  const playerList = game.players
    .map((p, i) => `${i === game.currentPlayerIndex ? '👉 ' : ''}${p.username} — ${p.hand.length} card${p.hand.length === 1 ? '' : 's'}`)
    .join('\n');

  return new EmbedBuilder()
    .setTitle('🎴 Uno')
    .setColor(0xE74C3C)
    .setDescription(`**Current card:** ${cardLabel(topCard)}\n**Color in play:** ${colorEmoji}\n\n**It's ${current.username}'s turn!**`)
    .addFields({ name: 'Players', value: playerList })
    .setFooter({ text: `Click "My Hand" below to view your cards and play.` });
}

function renderGameRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('uno_hand').setLabel('My Hand').setEmoji('🃏').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('uno_draw').setLabel('Draw Card').setEmoji('➕').setStyle(ButtonStyle.Secondary),
  );
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

module.exports = {
  renderLobbyEmbed,
  renderLobbyRow,
  renderKickSelect,
  renderGameEmbed,
  renderGameRow,
  renderHandComponents,
  renderColorChoiceRow,
};