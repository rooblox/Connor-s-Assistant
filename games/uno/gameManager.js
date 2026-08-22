// games/uno/gameManager.js
// Holds all currently active Uno games in memory (keyed by channel ID) and
// the core game logic: dealing, turns, playing cards, special effects,
// turn timeouts, and the UNO call/catch mechanic.

const { createShuffledDeck, canPlay } = require('./deck');

const games = new Map(); // channelId -> game state
const TURN_TIMEOUT_MS = 60_000; // 60s per turn before auto-skip

function createGame(channelId, guildId, hostId, client) {
  const game = {
    channelId,
    guildId,
    hostId,
    client, // stored so timer callbacks can fetch the channel later
    status: 'lobby', // lobby -> active -> finished
    players: [], // { id, username, hand: [] }
    deck: [],
    discardPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: null,
    pendingWild: null, // { userId, cardUid } - waiting on a color choice
    pendingUnoCallerId: null, // player who has 1 card and hasn't called UNO yet
    turnTimer: null,
    deletionTimer: null,
  };
  games.set(channelId, game);
  return game;
}

function getGame(channelId) {
  return games.get(channelId);
}

function deleteGame(channelId) {
  const game = games.get(channelId);
  if (game) {
    clearTurnTimer(game);
    if (game.deletionTimer) clearTimeout(game.deletionTimer);
  }
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

  let firstCard = game.deck.pop();
  while (firstCard.color === 'wild') {
    game.deck.unshift(firstCard);
    firstCard = game.deck.pop();
  }
  game.discardPile = [firstCard];
  game.currentColor = firstCard.color;
  game.currentPlayerIndex = 0;
  game.status = 'active';
  game.pendingUnoCallerId = null;

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
    if (game.deck.length === 0) break;
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

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);
  game.currentColor = card.color === 'wild' ? chosenColor : card.color;

  if (player.hand.length === 0) {
    game.status = 'finished';
    return { success: true, winner: player };
  }

  // Track the UNO-call window
  if (player.hand.length === 1) {
    game.pendingUnoCallerId = player.id;
  } else if (game.pendingUnoCallerId === player.id) {
    game.pendingUnoCallerId = null; // they drew back above 1, safe
  }

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
      if (game.players.length === 2) turnAdvance = 2;
      break;
    case 'drawTwo': {
      advanceTurn(game, 1);
      const victim = currentPlayer(game);
      drawCards(game, victim, 2);
      effectMessage = `${victim.username} draws 2 cards and is skipped!`;
      turnAdvance = 1;
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
  if (game.pendingUnoCallerId === player.id && player.hand.length > 1) {
    game.pendingUnoCallerId = null;
  }
  advanceTurn(game, 1);
  return player;
}

function callUno(game, userId) {
  if (game.pendingUnoCallerId === userId) {
    game.pendingUnoCallerId = null;
    return true;
  }
  return false;
}

// Another player catches someone who forgot to call UNO - they draw 2 penalty cards
function catchUnoFailure(game) {
  if (!game.pendingUnoCallerId) return null;
  const offender = game.players.find(p => p.id === game.pendingUnoCallerId);
  if (!offender) return null;
  drawCards(game, offender, 2);
  game.pendingUnoCallerId = null;
  return offender;
}

function clearTurnTimer(game) {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
}

function scheduleTurnTimeout(game, onTimeout) {
  clearTurnTimer(game);
  game.turnTimer = setTimeout(onTimeout, TURN_TIMEOUT_MS);
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
  callUno,
  catchUnoFailure,
  clearTurnTimer,
  scheduleTurnTimeout,
  games,
};