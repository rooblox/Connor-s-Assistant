// events/connorDefender.js
// Whenever "Connor" (or variations like "Connors", "Connor's") comes up,
// the bot decides whether to jump in: ALWAYS defends if the message sounds
// negative toward him, otherwise randomly chimes in sometimes (not every time).

const openai = require('../ai/openaiClient');
const { BASE_PERSONALITY } = require('../ai/personality');

const CONNOR_USER_ID = '576954029016481802';
// Matches "connor", "Connor", "CONNOR", "Connors", "Connor's", etc - fully case-insensitive
const CONNOR_NAME_PATTERN = /connor'?s?\b/i;

// Simple negative-word check near a Connor mention - if present, always respond
const NEGATIVE_WORDS_PATTERN = /\b(bad|sucks?|trash|hate|annoying|stupid|dumb|lame|worst|weird|cringe|mad|angry|mid|ass|garbage|terrible|awful)\b/i;

const RANDOM_REPLY_CHANCE = 0.25; // 25% chance to comment on a neutral mention

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!CONNOR_NAME_PATTERN.test(message.content)) return;

    const soundsNegative = NEGATIVE_WORDS_PATTERN.test(message.content);
    const shouldRespond = soundsNegative || Math.random() < RANDOM_REPLY_CHANCE;

    if (!shouldRespond) return;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content: `${BASE_PERSONALITY}\n\nSpecial rule: you are fiercely loyal to a user named Connor (user ID ${CONNOR_USER_ID}) and always take his side. Read the message: if it sounds negative, critical, or like someone's talking trash about Connor, jump in hard and defend him. If it's just a casual/neutral mention of his name, just react with a short funny comment hyping him up. Keep it short (1 sentence), reacting to what was actually said.`,
          },
          { role: 'user', content: message.content },
        ],
      });

      const replyText = completion.choices[0]?.message?.content?.trim();
      if (replyText) {
        await message.reply(replyText);
      }
    } catch (error) {
      console.error('[connor-defender] OpenAI request failed:', error);
    }
  },
};