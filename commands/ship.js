// commands/ship.js
// Ships two users together with a random compatibility % and a funny blurb.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const openai = require('../ai/openaiClient');
const { BASE_PERSONALITY } = require('../ai/personality');

function shipName(nameA, nameB) {
  const half1 = nameA.slice(0, Math.ceil(nameA.length / 2));
  const half2 = nameB.slice(Math.floor(nameB.length / 2));
  return half1 + half2;
}

function loveBar(percent) {
  const filled = Math.round(percent / 10);
  return '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Ship two people together')
    .addUserOption(option =>
      option.setName('user1').setDescription('First person').setRequired(true))
    .addUserOption(option =>
      option.setName('user2').setDescription('Second person').setRequired(true)),

  async execute(interaction) {
    const userA = interaction.options.getUser('user1');
    const userB = interaction.options.getUser('user2');

    if (userA.id === userB.id) {
      return interaction.reply({ content: `Can't ship someone with themselves... or can you?`, ephemeral: true });
    }

    await interaction.deferReply();

    const memberA = await interaction.guild.members.fetch(userA.id).catch(() => null);
    const memberB = await interaction.guild.members.fetch(userB.id).catch(() => null);
    const nameA = memberA ? memberA.displayName : userA.username;
    const nameB = memberB ? memberB.displayName : userB.username;

    const percent = Math.floor(Math.random() * 101);
    const combinedName = shipName(nameA, nameB);

    let blurb = '';
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [
          { role: 'system', content: BASE_PERSONALITY },
          { role: 'user', content: `Write a short, funny 1-sentence "ship compatibility" verdict for ${nameA} and ${nameB} at ${percent}% compatibility. Playful, not romantic/creepy, just silly.` },
        ],
      });
      blurb = completion.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('[ship] OpenAI request failed:', error);
    }

    const embed = new EmbedBuilder()
      .setTitle(`💘 ${nameA} × ${nameB}`)
      .setColor(0xFF6B9D)
      .setDescription(`**Ship name:** ${combinedName}\n**Compatibility:** ${percent}%\n${loveBar(percent)}${blurb ? `\n\n${blurb}` : ''}`);

    await interaction.editReply({ embeds: [embed] });
  },
};