// events/randomJumpIn.js
// Every so often (rare, random chance per message), the bot jumps into
// the conversation unprompted with a reaction to what's being discussed.

const openai = require('../ai/openaiClient');
const { BASE_PERSONALITY } = require('../ai/personality');
const { isInWatchedCategory } = require('../utils/categoryCheck');

const JUMP_IN_CHANCE = 0.01; // ~1% chance per eligible message - keep it rare
const COOLDOWN_MS = 5 * 60 * 1000; // don't jump in more than once per 5 min per channel

const lastJumpInByChannel = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!isInWatchedCategory(message)) return;
    if (message.mentions.users.has(message.client.user.id)) return; // let mentionChat.js handle direct pings
    if (message.content.trim().length < 5) return; // skip super short/low-effort messages

    const lastJumpIn = lastJumpInByChannel.get(message.channel.id) || 0;
    if (Date.now() - lastJumpIn < COOLDOWN_MS) return;

    if (Math.random() > JUMP_IN_CHANCE) return;

    try {
      const recent = await message.channel.messages.fetch({ limit: 8 });
      const chatContext = recent
        .filter(m => m.content.trim() !== '')
        .reverse()
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content: `${BASE_PERSONALITY}\n\nYou're randomly jumping into an ongoing conversation, unprompted, like a friend who couldn't help but chime in. React naturally to what's being discussed below. Keep it very short (1 sentence) and only worth saying if it's actually funny or adds something - don't force it.`,
          },
          { role: 'user', content: chatContext },
        ],
      });

      const replyText = completion.choices[0]?.message?.content?.trim();
      if (replyText) {
        lastJumpInByChannel.set(message.channel.id, Date.now());
        await message.channel.send(replyText);
      }
    } catch (error) {
      console.error('[random-jump-in] Failed:', error);
    }
  },
};