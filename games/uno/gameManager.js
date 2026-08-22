// games/uno/gameManager.js
// Holds all currently active Uno games in memory (keyed by channel ID) and
// the core game logic: dealing, turns, playing cards, special effects,
// turn timeouts, the UNO call/catch mechanic, and Intense mode rules
// (stacking draw cards, the 7-0 rule, faster turns).

const { createShuffledDeck, canPlay } = require('./deck');

const games = new Map(); // channelId -> game state

function turnTimeoutMs(game) {
  return game.mode === 'intense' ? 30_000 : 60_000;
}

function createGame(channelId, guildId, hostId, client, mode = 'classic') {
  const game = {
    channelId,
    guildId,
    hostId,
    client,
    mode, // 'classic' | 'intense'
    status: 'lobby',
    players: [],
    deck: [],
    discardPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: null,
    pendingWild: null,
    pendingUnoCallerId: null,
    pendingDrawStack: null, // { type: 'drawTwo' | 'wildDrawFour', amount } - Intense mode only
    pendingSevenSwap: null, // { userId } - Intense mode only, waiting on swap target choice
    turnTimer: null,
    deletionTimer: null,
    messagesSinceRepost: 0,
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
  game.pendingDrawStack = null;
  game.pendingSevenSwap = null;

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
  const isIntense = game.mode === 'intense';
  const topCard = game.discardPile[game.discardPile.length - 1];
  const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
  if (cardIndex === -1) return { success: false, message: `Card not found in your hand.` };

  const card = player.hand[cardIndex];

  // --- Intense mode: if a draw stack is pending, you can ONLY stack a matching card or draw ---
  if (isIntense && game.pendingDrawStack) {
    const stackType = game.pendingDrawStack.type;
    if (card.type !== stackType) {
      return { success: false, message: `A Draw stack is active! You must play another ${stackType === 'drawTwo' ? 'Draw Two' : 'Wild Draw Four'} to stack it, or draw the pile.` };
    }
    if (stackType === 'wildDrawFour' && !chosenColor) {
      return { success: false, message: `Choose a color for your Wild Draw Four.`, needsColor: true };
    }
  } else if (!canPlay(card, topCard, game.currentColor)) {
    return { success: false, message: `That card doesn't match the current color/value.` };
  }
  if (!game.pendingDrawStack && (card.type === 'wild' || card.type === 'wildDrawFour') && !chosenColor) {
    return { success: false, message: `You need to choose a color for that card.`, needsColor: true };
  }

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);
  game.currentColor = card.color === 'wild' ? chosenColor : card.color;

  if (player.hand.length === 0) {
    game.status = 'finished';
    return { success: true, winner: player };
  }

  if (player.hand.length === 1) {
    game.pendingUnoCallerId = player.id;
  } else if (game.pendingUnoCallerId === player.id) {
    game.pendingUnoCallerId = null;
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
      if (isIntense) {
        game.pendingDrawStack = {
          type: 'drawTwo',
          amount: (game.pendingDrawStack?.amount || 0) + 2,
        };
        effectMessage = `🥞 Draw stack is now **${game.pendingDrawStack.amount}**! Stack another Draw Two or draw the pile.`;
        turnAdvance = 1;
      } else {
        advanceTurn(game, 1);
        const victim = currentPlayer(game);
        drawCards(game, victim, 2);
        effectMessage = `${victim.username} draws 2 cards and is skipped!`;
        turnAdvance = 1;
      }
      break;
    }

    case 'wildDrawFour': {
      if (isIntense) {
        game.pendingDrawStack = {
          type: 'wildDrawFour',
          amount: (game.pendingDrawStack?.amount || 0) + 4,
        };
        effectMessage = `🥞 Draw stack is now **${game.pendingDrawStack.amount}**! Stack another Wild Draw Four or draw the pile.`;
        turnAdvance = 1;
      } else {
        advanceTurn(game, 1);
        const victim = currentPlayer(game);
        drawCards(game, victim, 4);
        effectMessage = `${victim.username} draws 4 cards and is skipped!`;
        turnAdvance = 1;
      }
      break;
    }

    case 'number':
      if (isIntense && card.value === 7) {
        advanceTurn(game, turnAdvance);
        return { success: true, needsSevenSwap: true, message: `7️⃣ played! Choose someone to swap hands with.` };
      }
      if (isIntense && card.value === 0) {
        rotateAllHands(game);
        effectMessage = `0️⃣ played! Everyone's hands rotated!`;
      }
      break;
  }

  advanceTurn(game, turnAdvance);

  return { success: true, message: effectMessage };
}

// Intense mode: 7 rule - swap hands between two players
function performSevenSwap(game, fromUserId, toUserId) {
  const fromPlayer = game.players.find(p => p.id === fromUserId);
  const toPlayer = game.players.find(p => p.id === toUserId);
  if (!fromPlayer || !toPlayer) return null;

  const temp = fromPlayer.hand;
  fromPlayer.hand = toPlayer.hand;
  toPlayer.hand = temp;

  game.pendingSevenSwap = null;
  return { fromPlayer, toPlayer };
}

// Intense mode: 0 rule - rotate all hands one position in the current direction
function rotateAllHands(game) {
  const hands = game.players.map(p => p.hand);
  const count = game.players.length;
  for (let i = 0; i < count; i++) {
    const sourceIndex = (i - game.direction + count) % count;
    game.players[i].hand = hands[sourceIndex];
  }
}

function drawCardForCurrentPlayer(game) {
  const player = currentPlayer(game);

  if (game.pendingDrawStack) {
    drawCards(game, player, game.pendingDrawStack.amount);
    game.pendingDrawStack = null;
  } else {
    drawCards(game, player, 1);
  }

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
  game.turnTimer = setTimeout(onTimeout, turnTimeoutMs(game));
}

module.exports = {
  createGame,
  getGame,
  deleteGame,
  addPlayer,
  startGame,
  currentPlayer,
  playCard,
  performSevenSwap,
  drawCardForCurrentPlayer,
  callUno,
  catchUnoFailure,
  clearTurnTimer,
  scheduleTurnTimeout,
  games,
};