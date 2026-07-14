// games/uno/deck.js
// Builds a standard 108-card Uno deck and provides card display helpers.

const COLORS = ['red', 'blue', 'green', 'yellow'];
const COLOR_EMOJI = { red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡', wild: '⬛' };

let cardCounter = 0;

function makeCard(color, type, value = null) {
  cardCounter += 1;
  return { uid: `c${cardCounter}`, color, type, value };
}

function createShuffledDeck() {
  const deck = [];

  for (const color of COLORS) {
    deck.push(makeCard(color, 'number', 0));
    for (let value = 1; value <= 9; value++) {
      deck.push(makeCard(color, 'number', value));
      deck.push(makeCard(color, 'number', value));
    }
    for (let i = 0; i < 2; i++) {
      deck.push(makeCard(color, 'skip'));
      deck.push(makeCard(color, 'reverse'));
      deck.push(makeCard(color, 'drawTwo'));
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push(makeCard('wild', 'wild'));
    deck.push(makeCard('wild', 'wildDrawFour'));
  }

  // Shuffle (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function cardLabel(card) {
  const emoji = COLOR_EMOJI[card.color];
  switch (card.type) {
    case 'number': return `${emoji} ${card.value}`;
    case 'skip': return `${emoji} Skip`;
    case 'reverse': return `${emoji} Reverse`;
    case 'drawTwo': return `${emoji} Draw Two`;
    case 'wild': return `⬛ Wild`;
    case 'wildDrawFour': return `⬛ Wild Draw Four`;
    default: return 'Unknown card';
  }
}

function canPlay(card, topCard, currentColor) {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (topCard.type === 'number' && card.type === 'number' && card.value === topCard.value) return true;
  if (card.type !== 'number' && card.type === topCard.type) return true;
  return false;
}

module.exports = { createShuffledDeck, cardLabel, canPlay, COLORS, COLOR_EMOJI };