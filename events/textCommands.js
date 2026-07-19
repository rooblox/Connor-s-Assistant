// events/textCommands.js
// Simple prefix commands: -compliment @user, -roast @user, -target @user
// (generates a funny "wanted poster" style callout).

const { EmbedBuilder } = require('discord.js');
const openai = require('../ai/openaiClient');
const { BASE_PERSONALITY, JOKE_TARGETS } = require('../ai/personality');
const { isInWatchedCategory } = require('../utils/categoryCheck');

const COMMAND_PATTERN = /^-(compliment|roast|target)\s+<@!?(\d+)>/i;

async function generateText(prompt) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 150,
    messages: [
      { role: 'system', content: BASE_PERSONALITY },
      { role: 'user', content: prompt },
    ],
  });
  return completion.choices[0]?.message?.content?.trim();
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!isInWatchedCategory(message)) return;

    const match = message.content.match(COMMAND_PATTERN);
    if (!match) return;

    const [, commandType, targetUserId] = match;
    const member = await message.guild.members.fetch(targetUserId).catch(() => null);
    if (!member) {
      return message.reply(`Couldn't find that user.`);
    }
    const targetName = member.displayName;

    await message.channel.sendTyping();

    try {
      if (commandType.toLowerCase() === 'compliment') {
        if (JOKE_TARGETS[targetUserId]) {
          const refusals = [
            `Sorry, I don't compliment ${targetName}. It's policy.`,
            `${targetName}? Yeah, no. I have standards.`,
            `I'll compliment anyone in this server except ${targetName}, try again.`,
          ];
          await message.reply(refusals[Math.floor(Math.random() * refusals.length)]);
          return;
        }
        const text = await generateText(`Write a short, genuine but funny compliment about a Discord server member named "${targetName}". Keep it 1-2 sentences.`);
        await message.reply(text || `${targetName} is pretty great, honestly.`);
        return;
      }

      if (commandType.toLowerCase() === 'roast') {
        const text = await generateText(`Write a short, playful roast of a Discord server member named "${targetName}". Keep it lighthearted, funny, not genuinely mean, 1-2 sentences.`);
        await message.reply(text || `${targetName}... yeah I got nothing, you're safe today.`);
        return;
      }

      if (commandType.toLowerCase() === 'target') {
        const text = await generateText(`Generate content for a funny "WANTED" poster about a Discord server member named "${targetName}", in the style of an old western wanted poster but for silly, made-up "crimes" (nothing real, nothing actually mean). Respond ONLY with these 4 lines, nothing else, no markdown:\nCRIME: <a short silly made-up crime>\nBOUNTY: <a funny made-up dollar amount>\nLAST SEEN: <a funny made-up location>\nNOTORIOUS FOR: <a short funny trait>`);

        const lines = (text || '').split('\n').reduce((acc, line) => {
          const [key, ...rest] = line.split(':');
          if (key && rest.length) acc[key.trim().toUpperCase()] = rest.join(':').trim();
          return acc;
        }, {});

        const embed = new EmbedBuilder()
          .setTitle(`🤠 WANTED: ${targetName}`)
          .setColor(0xC0392B)
          .setThumbnail(member.displayAvatarURL())
          .addFields(
            { name: 'Crime', value: lines.CRIME || 'Unknown mischief', inline: false },
            { name: 'Bounty', value: lines.BOUNTY || '$1', inline: true },
            { name: 'Last Seen', value: lines['LAST SEEN'] || 'Unknown', inline: true },
            { name: 'Notorious For', value: lines['NOTORIOUS FOR'] || 'Being around', inline: false },
          );

        await message.reply({ embeds: [embed] });
        return;
      }
    } catch (error) {
      console.error('[text-commands] Failed:', error);
      await message.reply(`Something went wrong with that.`);
    }
  },
};