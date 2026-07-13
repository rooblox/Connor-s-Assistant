// events/mentionChat.js
// When someone @mentions the bot, it reads their question PLUS the last
// ~15 messages in the channel for context, so it actually knows what's
// being talked about instead of answering blind. Only searches the web
// if explicitly asked.

const openai = require('../ai/openaiClient');
const { BASE_PERSONALITY, JOKE_TARGETS } = require('../ai/personality');
const { findMentionedMembers } = require('../ai/memberLookup');

const JOKE_NAME_PATTERN = new RegExp(
  `\\b(${Object.values(JOKE_TARGETS).join('|')})\\b`,
  'i'
);

const SEARCH_INTENT_PATTERN = /\b(search|google|look ?up|find out|what'?s (the )?(latest|current|news)|current price|current weather)\b/i;

async function getRecentChatContext(channel, excludeMessageId) {
  try {
    const recent = await channel.messages.fetch({ limit: 15 });
    return recent
      .filter(m => m.id !== excludeMessageId && m.content.trim() !== '')
      .reverse()
      .map(m => `${m.author.username}: ${m.content}`)
      .join('\n');
  } catch {
    return '';
  }
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    const botWasMentioned = message.mentions.users.has(message.client.user.id);
    if (!botWasMentioned) return;

    const question = message.content
      .replace(new RegExp(`<@!?${message.client.user.id}>`, 'g'), '')
      .trim();

    if (!question) {
      await message.reply(`What's up? Ask me something!`);
      return;
    }

    await message.channel.sendTyping();

    const jokeTargetMatch = question.match(JOKE_NAME_PATTERN);
    const otherMembers = findMentionedMembers(message.guild, question);
    const explicitSearchRequest = SEARCH_INTENT_PATTERN.test(question);
    const chatContext = await getRecentChatContext(message.channel, message.id);

    let systemPrompt = BASE_PERSONALITY;

    if (chatContext) {
      systemPrompt += `\n\nHere's the recent conversation in this channel for context (most recent last). Use it to understand what's being discussed, inside jokes, or what people have said, if relevant to the question:\n${chatContext}`;
    }

    if (jokeTargetMatch) {
      systemPrompt += `\n\nThe user just mentioned "${jokeTargetMatch[0]}" - this is 100% referring to the Discord server member with that name, one of your running joke targets. Do NOT treat this as any real-world public figure, artist, or celebrity under any circumstances. Respond with a short, funny, Discord-flavored joke/jab about them as a server member - not factual claims about a real person.`;
    } else if (otherMembers.length > 0) {
      const memberContext = otherMembers
        .map(m => `- ${m.displayName} (username: ${m.username}${m.roles.length ? `, roles: ${m.roles.join(', ')}` : ''})`)
        .join('\n');
      systemPrompt += `\n\nImportant: this message refers to real member(s) of THIS Discord server, not any public figure or celebrity with a similar name:\n${memberContext}`;
    }

    const model = explicitSearchRequest ? 'gpt-4o-search-preview' : 'gpt-4o-mini';

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      });

      let replyText = completion.choices[0]?.message?.content?.trim();

      if (!replyText) {
        replyText = `Couldn't come up with anything for that one, try me again.`;
      }

      if (replyText.length > 2000) {
        replyText = replyText.slice(0, 1997) + '...';
      }

      await message.reply(replyText);
    } catch (error) {
      console.error('[mention-chat] OpenAI request failed:', error);
      await message.reply(`Something broke asking that — try again in a bit.`);
    }
  },
};