// games/uno/gameManager.js
// Holds all currently active Uno games in memory (keyed by channel ID) and
// the core game logic: dealing, turns, playing cards, special effects.

const { createShuffledDeck, canPlay } = require('./deck');

const games = new Map(); // channelId -> game state

function createGame(channelId, guildId, hostId) {
  const game = {
    channelId,
    guildId,
    hostId,
    status: 'lobby', // lobby -> active -> finished
    players: [], // { id, username, hand: [] }
    deck: [],
    discardPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: null,
    pendingWild: null, // { userId, cardUid } - waiting on a color choice
  };
  games.set(channelId, game);
  return game;
}

function getGame(channelId) {
  return games.get(channelId);
}

function deleteGame(channelId) {
  games.delete(channelId);
}

function addPlayer(game, userId, username) {
  if (game.players.some(p => p.id === userId)) return false;
  game.players.push({ id: userId, username, hand: [] });
  return true;
}

function startGame(game) {
  game.deck = createShuffledDeck();
  for (const player of game.players) {
    player.hand = game.deck.splice(0, 7);
  }

  // Flip first card - if it's a wild, just keep re-shuffling it back and drawing again
  let firstCard = game.deck.pop();
  while (firstCard.color === 'wild') {
    game.deck.unshift(firstCard);
    firstCard = game.deck.pop();
  }
  game.discardPile = [firstCard];
  game.currentColor = firstCard.color;
  game.currentPlayerIndex = 0;
  game.status = 'active';

  return firstCard;
}

function currentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

function advanceTurn(game, steps = 1) {
  const count = game.players.length;
  game.currentPlayerIndex = (game.currentPlayerIndex + game.direction * steps + count * steps) % count;
}

function drawCards(game, player, count) {
  for (let i = 0; i < count; i++) {
    if (game.deck.length === 0) reshuffleDiscardIntoDeck(game);
    if (game.deck.length === 0) break; // truly nothing left
    player.hand.push(game.deck.pop());
  }
}

function reshuffleDiscardIntoDeck(game) {
  const topCard = game.discardPile.pop();
  game.deck = game.discardPile;
  game.discardPile = [topCard];
  for (let i = game.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [game.deck[i], game.deck[j]] = [game.deck[j], game.deck[i]];
  }
}

// Plays a card for the current player. chosenColor only needed for wild cards.
// Returns { success, message, winner }
function playCard(game, player, cardUid, chosenColor) {
  const topCard = game.discardPile[game.discardPile.length - 1];
  const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
  if (cardIndex === -1) return { success: false, message: `Card not found in your hand.` };

  const card = player.hand[cardIndex];
  if (!canPlay(card, topCard, game.currentColor)) {
    return { success: false, message: `That card doesn't match the current color/value.` };
  }
  if ((card.type === 'wild' || card.type === 'wildDrawFour') && !chosenColor) {
    return { success: false, message: `You need to choose a color for that card.`, needsColor: true };
  }

  // Remove from hand, add to discard
  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);
  game.currentColor = card.color === 'wild' ? chosenColor : card.color;

  if (player.hand.length === 0) {
    game.status = 'finished';
    return { success: true, winner: player };
  }

  // Apply card effects
  let turnAdvance = 1;
  let effectMessage = '';

  switch (card.type) {
    case 'skip':
      turnAdvance = 2;
      effectMessage = `⏭️ Skipped the next player!`;
      break;
    case 'reverse':
      game.direction *= -1;
      effectMessage = `🔄 Direction reversed!`;
      if (game.players.length === 2) turnAdvance = 2; // acts like skip in 2-player
      break;
    case 'drawTwo': {
      advanceTurn(game, 1);
      const victim = currentPlayer(game);
      drawCards(game, victim, 2);
      effectMessage = `${victim.username} draws 2 cards and is skipped!`;
      turnAdvance = 1; // we already advanced once above, one more moves past the victim
      break;
    }
    case 'wildDrawFour': {
      advanceTurn(game, 1);
      const victim = currentPlayer(game);
      drawCards(game, victim, 4);
      effectMessage = `${victim.username} draws 4 cards and is skipped!`;
      turnAdvance = 1;
      break;
    }
  }

  advanceTurn(game, turnAdvance);

  return { success: true, message: effectMessage };
}

function drawCardForCurrentPlayer(game) {
  const player = currentPlayer(game);
  drawCards(game, player, 1);
  advanceTurn(game, 1);
  return player;
}

module.exports = {
  createGame,
  getGame,
  deleteGame,
  addPlayer,
  startGame,
  currentPlayer,
  playCard,
  drawCardForCurrentPlayer,
  games,
};