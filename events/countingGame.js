// events/countingGame.js
// Counting game with math expression support (3x3, 9/3, 4+5 etc), persisted
// to MongoDB so it survives restarts, plus per-user streak/stat tracking.

const CountingState = require('../models/CountingState');
const CountingStats = require('../models/CountingStats');

// Only digits, + - * / . and whitespace are allowed - anything else means
// it's not a math expression at all, so we just ignore the message.
const SAFE_MATH_PATTERN = /^[0-9+\-*/.\s]+$/;

function tryEvaluateMath(rawContent) {
  // Let people use "x" or "X" as multiplication too
  const normalized = rawContent.trim().replace(/x/gi, '*');

  if (!SAFE_MATH_PATTERN.test(normalized)) return null;
  if (normalized.trim() === '') return null;

  try {
    // Character set is locked down above to digits/operators only,
    // so this is safe from arbitrary code execution.
    const result = Function(`"use strict"; return (${normalized})`)();
    if (typeof result !== 'number' || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.channel.id !== process.env.COUNTING_CHANNEL_ID) return;
    if (message.author.bot) return;

    const submittedNumber = tryEvaluateMath(message.content);
    if (submittedNumber === null) return; // not a math expression at all, ignore

    // Load persisted state (creates it if this is the very first run)
    let state = await CountingState.findById('counting_state');
    if (!state) {
      state = await CountingState.create({ _id: 'counting_state' });
    }

    const isCorrectNumber = submittedNumber === state.currentCount;
    const isSameUserTwice = message.author.id === state.lastUserId;

    if (isCorrectNumber && !isSameUserTwice) {
      await message.react('✅');

      state.currentCount += 1;
      state.lastUserId = message.author.id;
      await state.save();

      // Update this user's stats
      let stats = await CountingStats.findOne({ userId: message.author.id });
      if (!stats) {
        stats = await CountingStats.create({ userId: message.author.id });
      }
      stats.correctCount += 1;
      stats.currentStreak += 1;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
      await stats.save();
      return;
    }

    // Wrong turn
    await message.react('❌');

    const reason = isSameUserTwice
      ? `you can't count twice in a row — let someone else go!`
      : `that wasn't the right number. Next number was **${state.currentCount}**.`;

    await message.reply(`❌ Busted, <@${message.author.id}> — ${reason} Count reset to **1**.`);

    state.currentCount = 1;
    state.lastUserId = null;
    await state.save();

    // Reset the messer-upper's personal streak
    let stats = await CountingStats.findOne({ userId: message.author.id });
    if (!stats) {
      stats = await CountingStats.create({ userId: message.author.id });
    }
    stats.currentStreak = 0;
    await stats.save();

    await transferBadgeRole(message);
  },
};

async function transferBadgeRole(message) {
  const roleId = process.env.COUNTING_BADGE_ROLE_ID;
  const guild = message.guild;
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    console.warn(`[counting] Badge role ${roleId} not found in guild.`);
    return;
  }

  const currentHolders = role.members;
  for (const [, member] of currentHolders) {
    if (member.id !== message.author.id) {
      await member.roles.remove(role).catch(() => {});
    }
  }

  const member = await guild.members.fetch(message.author.id).catch(() => null);
  if (member) {
    await member.roles.add(role).catch(() => {});
  }
}
