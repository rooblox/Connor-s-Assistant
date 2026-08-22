// events/unoMessageWatcher.js
// Watches channels with an active Uno game. Once 5+ other messages have
// been sent since the game panel was last posted, reposts it fresh at
// the bottom of the channel so people don't have to scroll up for it.

const gameManager = require('../games/uno/gameManager');
const { renderLobbyEmbed, renderLobbyRow, renderGameEmbed, renderGameRow } = require('../games/uno/render');

const REPOST_THRESHOLD = 5;

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    const game = gameManager.getGame(message.channel.id);
    if (!game) return;
    if (game.status !== 'lobby' && game.status !== 'active') return; // don't repost a finished game

    game.messagesSinceRepost = (game.messagesSinceRepost || 0) + 1;
    if (game.messagesSinceRepost < REPOST_THRESHOLD) return;

    game.messagesSinceRepost = 0;

    // Delete the old panel message if we still can, then post a fresh one
    if (game.publicMessageId) {
      const oldMessage = await message.channel.messages.fetch(game.publicMessageId).catch(() => null);
      if (oldMessage) await oldMessage.delete().catch(() => {});
    }

    let newMessage;
    if (game.status === 'lobby') {
      newMessage = await message.channel.send({ embeds: [renderLobbyEmbed(game)], components: [renderLobbyRow()] });
    } else {
      newMessage = await message.channel.send({ embeds: [renderGameEmbed(game)], components: [renderGameRow(game)] });
    }

    game.publicMessageId = newMessage.id;
  },
};