// events/countingGame.js
// Counting game: math expressions (3x3, 9/3, 4+5), MongoDB persistence,
// streaks, milestones, and Save Tokens.
//
// - Correct count: ✅ (💯 on exactly 100, 🎉 on every later multiple of 100)
// - Bust: ❌, call-out, "you lost it at N", count resets to 1, badge role moves.
//   If the person holds a Save Token they get 30 seconds to spend it and
//   keep the count. The count is paused while they decide.
// - Every 50 correct counts earns a Save Token (max 3 held).
// - Milestones (100, 500, then every 1000) get an announcement embed.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const CountingState = require('../models/CountingState');
const CountingStats = require('../models/CountingStats');

const TOKEN_EVERY = 50;        // correct counts needed to earn a Save Token
const MAX_TOKENS = 3;          // most tokens one person can hold
const SAVE_WINDOW_MS = 30_000; // time to use a token after busting

// Only digits, + - * / . and whitespace are allowed - anything else means
// it's not a math expression at all, so we just ignore the message.
const SAFE_MATH_PATTERN = /^[0-9+\-*/.\s]+$/;

// Set while a bust is waiting on the 30s Save Token decision.
// Counting messages are ignored while this is set.
let pendingBust = null;

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

// Which reaction a correct count gets
function reactionFor(number) {
  if (number === 100) return '💯';
  if (number % 100 === 0) return '🎉';
  return '✅';
}

function isMilestone(number) {
  return number === 100 || number === 500 || (number >= 1000 && number % 1000 === 0);
}

function bustReason(isSameUserTwice, expectedNumber) {
  return isSameUserTwice
    ? `you can't count twice in a row — let someone else go!`
    : `that wasn't the right number. Next number was **${expectedNumber}**.`;
}

async function getStats(userId) {
  let stats = await CountingStats.findOne({ userId });
  if (!stats) stats = await CountingStats.create({ userId });
  return stats;
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.channel.id !== process.env.COUNTING_CHANNEL_ID) return;
    if (message.author.bot) return;
    if (pendingBust) return; // count is paused while someone decides on a Save Token

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
      await handleCorrectCount(message, state);
      return;
    }

    await handleBust(message, state, isSameUserTwice);
  },

  // Shared with the edit/delete watchers and /countstats
  tryEvaluateMath,
  TOKEN_EVERY,
  MAX_TOKENS,
};

async function handleCorrectCount(message, state) {
  const countedNumber = state.currentCount;
  await message.react(reactionFor(countedNumber)).catch(() => {});

  state.currentCount += 1;
  state.lastUserId = message.author.id;
  state.lastMessageId = message.id; // so we can catch it if they delete or edit it

  // Tally this user's contribution to the current run
  if (!state.runContributions) state.runContributions = [];
  const entry = state.runContributions.find(e => e.userId === message.author.id);
  if (entry) {
    entry.count += 1;
  } else {
    state.runContributions.push({ userId: message.author.id, count: 1 });
  }
  await state.save();

  // Update this user's stats
  const stats = await getStats(message.author.id);
  stats.correctCount += 1;
  stats.currentStreak += 1;
  if (stats.currentStreak > stats.bestStreak) {
    stats.bestStreak = stats.currentStreak;
  }

  let earnedToken = false;
  if (stats.correctCount % TOKEN_EVERY === 0 && stats.saveTokens < MAX_TOKENS) {
    stats.saveTokens += 1;
    earnedToken = true;
  }
  await stats.save();

  if (earnedToken) {
    await message.channel.send(
      `🛡️ <@${message.author.id}> earned a **Save Token** for hitting ${stats.correctCount} correct counts! ` +
      `You're holding ${stats.saveTokens}/${MAX_TOKENS}. If you bust the count you'll get 30 seconds to use one.`
    ).catch(() => {});
  }

  if (isMilestone(countedNumber)) {
    await announceMilestone(message.channel, state, countedNumber);
  }
}

async function announceMilestone(channel, state, number) {
  const medals = ['🥇', '🥈', '🥉'];
  const top = [...(state.runContributions || [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const contributorLines = top.map((entry, i) => `${medals[i]} <@${entry.userId}> — **${entry.count}** counts`);

  const record = state.highScore || 0;
  const recordLine = number > record
    ? `🏆 Past the server record of **${record}**!`
    : `Server record: **${record}**`;

  const embed = new EmbedBuilder()
    .setTitle(`🏁 Milestone: ${number}!`)
    .setColor(0xF1C40F)
    .setDescription(`The count just hit **${number}**!`)
    .setFooter({ text: recordLine.replace(/\*\*/g, '') });

  if (contributorLines.length > 0) {
    embed.addFields({ name: 'Top counters this run', value: contributorLines.join('\n') });
  }

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function handleBust(message, state, isSameUserTwice) {
  pendingBust = { userId: message.author.id };
  let waitingOnSave = false;

  try {
    await message.react('❌').catch(() => {});

    const stats = await getStats(message.author.id);
    if (stats.saveTokens > 0) {
      await offerSave(message, state, isSameUserTwice);
      waitingOnSave = true; // the collector clears pendingBust when it ends
      return;
    }

    await finalizeBust(message, isSameUserTwice);
  } catch (error) {
    console.error('[counting] Bust handling failed:', error);
  } finally {
    if (!waitingOnSave) pendingBust = null;
  }
}

async function offerSave(message, state, isSameUserTwice) {
  const userId = message.author.id;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('counting_save')
      .setLabel('Use Save Token')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Success),
  );

  const prompt = await message.reply({
    content:
      `❌ <@${userId}> messed up! But you're holding a 🛡️ **Save Token**.\n` +
      `Use it in the next **30 seconds** to keep the count at **${state.currentCount}**, or it resets to 1. ` +
      `The count is paused until then.`,
    components: [row],
  });

  const collector = prompt.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: SAVE_WINDOW_MS,
  });

  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: `Only the person who messed up can use their Save Token.`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    // Spend the token atomically - only succeeds if they still have one
    const updated = await CountingStats.findOneAndUpdate(
      { userId, saveTokens: { $gte: 1 } },
      { $inc: { saveTokens: -1 } },
      { new: true }
    );

    if (!updated) {
      await interaction.reply({ content: `You don't have a Save Token anymore.`, flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }

    await interaction.update({
      content: `🛡️ <@${userId}> used a Save Token! The count stays at **${state.currentCount}**. (${updated.saveTokens} token${updated.saveTokens === 1 ? '' : 's'} left)`,
      components: [],
    }).catch(() => {});

    collector.stop('saved');
  });

  collector.on('end', async (_collected, reason) => {
    try {
      if (reason === 'saved') return;

      // Window closed without a save - remove the button and do the normal bust
      await prompt.edit({ components: [] }).catch(() => {});
      await finalizeBust(message, isSameUserTwice);
    } catch (error) {
      console.error('[counting] Finalizing bust after save window failed:', error);
    } finally {
      pendingBust = null;
    }
  });
}

// The "real" bust: reset the count, record the high score, update stats, move the badge role
async function finalizeBust(message, isSameUserTwice) {
  const userId = message.author.id;

  const state = await CountingState.findById('counting_state');
  if (!state) return;

  const expectedNumber = state.currentCount;
  const reached = expectedNumber - 1;
  const previousRecord = state.highScore || 0;
  const isNewRecord = reached > previousRecord;

  state.highScore = Math.max(previousRecord, reached);
  state.currentCount = 1;
  state.lastUserId = null;
  state.lastMessageId = null;
  state.runContributions = [];
  await state.save();

  const lines = [`❌ Busted, <@${userId}> — ${bustReason(isSameUserTwice, expectedNumber)}`];
  if (reached > 0) {
    lines.push(`💥 You lost it at **${reached}**.`);
    lines.push(
      isNewRecord
        ? `🏆 **New server record!** (previous: ${previousRecord})`
        : `Server record: **${previousRecord}**`
    );
  }
  lines.push(`Count reset to **1**.`);

  await message.channel.send(lines.join('\n'));

  // Ruined-count stat + reset their personal streak
  const stats = await getStats(userId);
  stats.ruinCount = (stats.ruinCount || 0) + 1;
  stats.currentStreak = 0;
  await stats.save();

  await