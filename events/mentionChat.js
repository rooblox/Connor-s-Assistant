// events/mentionChat.js
// The bot only talks when spoken to: someone @mentions it and it replies.
// Reads the question PLUS the last ~15 messages in the channel for context.
// Only searches the web if explicitly asked. Resolves other @mentions to
// real display names so "roast @someone" targets that person. Stays
// loyal to Connor whenever he comes up in a message directed at the bot.

const openai = require('../ai/openaiClient');
const { BASE_PERSONALITY, JOKE_TARGETS } = require('../ai/personality');
const { findMentionedMembers } = require('../ai/memberLookup');
const { isInWatchedCategory } = require('../utils/categoryCheck');
const RoastStats = require('../models/RoastStats');

const CONNOR_USER_ID = '576954029016481802';
const CONNOR_NAME_PATTERN = /connor'?s?\b/i;

const JOKE_NAME_PATTERN = new RegExp(
  `\\b(${Object.values(JOKE_TARGETS).join('|')})\\b`,
  'i'
);

const SEARCH_INTENT_PATTERN = /\b(search|google|look ?up|find out|what'?s (the )?(latest|current|news)|current price|current weather)\b/i;
const ROAST_INTENT_PATTERN = /\broast\b/i;

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

async function trackRoast(userId) {
  await RoastStats.findOneAndUpdate(
    { userId },
    { $inc: { roastCount: 1 } },
    { upsert: true }
  );
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!isInWatchedCategory(message)) return;

    const botWasMentioned = message.mentions.users.has(message.client.user.id);
    if (!botWasMentioned) return;

    const rawQuestion = message.content
      .replace(new RegExp(`<@!?${message.client.user.id}>`, 'g'), '')
      .trim();

    if (!rawQuestion) {
      await message.reply(`What's up? Ask me something!`);
      return;
    }

    // Resolve any OTHER user mentions into real display names so the AI
    // knows exactly who's being talked about.
    let targetedUserName = null;
    let targetedUserId = null;
    let question = rawQuestion;
    const mentionedUsersInMessage = message.mentions.users.filter(u => u.id !== message.client.user.id);
    for (const [, user] of mentionedUsersInMessage) {
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      const displayName = member ? member.displayName : user.username;
      targetedUserName = displayName;
      targetedUserId = user.id;
      question = question.replace(new RegExp(`<@!?${user.id}>`, 'g'), displayName);
    }

    await message.channel.sendTyping();

    const jokeTargetMatch = question.match(JOKE_NAME_PATTERN);
    const otherMembers = findMentionedMembers(message.guild, question);
    const explicitSearchRequest = SEARCH_INTENT_PATTERN.test(question);
    const chatContext = await getRecentChatContext(message.channel, message.id);
    const involvesConnor = CONNOR_NAME_PATTERN.test(question) || targetedUserId === CONNOR_USER_ID;

    let systemPrompt = BASE_PERSONALITY;

    if (chatContext) {
      systemPrompt += `\n\nHere's the recent conversation in this channel for context (most recent last). Use it to understand what's being discussed, inside jokes, or what people have said, if relevant to the question:\n${chatContext}`;
    }

    // An explicitly pinged target always beats the default joke-target bit.
    if (targetedUserName) {
      systemPrompt += `\n\nThe user is directing this command at a specific person: "${targetedUserName}". Target YOUR RESPONSE at this exact person - do not default to joking about Nina, Serry, or Lyric unless "${targetedUserName}" literally IS one of them.`;
    }

    if (jokeTargetMatch) {
      systemPrompt += `\n\nThe user mentioned "${jokeTargetMatch[0]}" - this is 100% referring to the Discord server member with that name, one of your running joke targets. Do NOT treat this as any real-world public figure, artist, or celebrity under any circumstances. Respond with a short, funny, Discord-flavored joke/jab about them as a server member - not factual claims about a real person.`;
    } else if (otherMembers.length > 0) {
      const memberContext = otherMembers
        .map(m => `- ${m.displayName} (username: ${m.username}${m.roles.length ? `, roles: ${m.roles.join(', ')}` : ''})`)
        .join('\n');
      systemPrompt += `\n\nImportant: this message refers to real member(s) of THIS Discord server, not any public figure or celebrity with a similar name:\n${memberContext}`;
    }

    if (involvesConnor) {
      systemPrompt += `\n\nConnor (user ID ${CONNOR_USER_ID}) is the server owner and you are fiercely loyal to him. If this message is negative toward him or asks you to roast, insult, or trash him, don't - defend him with a funny, short comeback instead. If he's just mentioned neutrally, you can hype him up in a sentence.`;
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

      // Beef board tracking, but not when the target is Connor
      if (targetedUserId && targetedUserId !== CONNOR_USER_ID && ROAST_INTENT_PATTERN.test(rawQuestion)) {
        await trackRoast(targetedUserId);
      }
    } catch (error) {
      console.error('[mention-chat] OpenAI request failed:', error);
      await message.reply(`Something broke asking that — try again in a bit.`);
    }
  },
};