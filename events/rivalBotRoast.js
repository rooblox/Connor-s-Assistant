// events/rivalBotRoast.js
// Roasts the rival bot in two situations:
// 1. Randomly (every 4-10 messages) when the rival bot itself posts
// 2. Every time a user @mentions the rival bot in their own message

const openai = require('../ai/openaiClient');

let messagesSeenSinceLastRoast = 0;
let nextRoastThreshold = randomThreshold();

function randomThreshold() {
  return Math.floor(Math.random() * (10 - 4 + 1)) + 4; // random int 4-10
}

async function generateRoast(contextText) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `You are a witty, confident Discord bot. Context: "${contextText}". Write a short, playful roast (1-2 sentences max) claiming you're the better bot compared to a rival bot. Keep it fun and lighthearted, never actually mean or offensive - just banter.`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim();
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    const rivalBotId = process.env.RIVAL_BOT_ID;

    // --- Case 1: the rival bot posted a message ---
    if (message.author.id === rivalBotId) {
      messagesSeenSinceLastRoast += 1;
      if (messagesSeenSinceLastRoast < nextRoastThreshold) return;

      messagesSeenSinceLastRoast = 0;
      nextRoastThreshold = randomThreshold();

      const rivalMessageContent = message.content || '(a non-text message)';

      try {
        const roastText = await generateRoast(`Another bot just said: "${rivalMessageContent}"`);
        if (roastText) {
          await message.channel.send(`<@${rivalBotId}> ${roastText}`);
        }
      } catch (error) {
        console.error('[rival-roast] Failed to generate roast (bot message):', error);
      }
      return;
    }

    // --- Case 2: a human mentioned the rival bot ---
    if (message.author.bot) return; // don't trigger off other bots mentioning it
    if (!message.mentions.users.has(rivalBotId)) return;

    try {
      const roastText = await generateRoast(`A user just said this, mentioning a rival bot: "${message.content}"`);
      if (roastText) {
        await message.reply(`<@${rivalBotId}> ${roastText}`);
      }
    } catch (error) {
      console.error('[rival-roast] Failed to generate roast (mention):', error);
    }
  },
};