// commands/thisorthat.js
// Posts a two-option poll. If options aren't given, AI generates a
// random silly "would you rather" style pair. People vote by reacting.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const openai = require('../ai/openaiClient');
const { BASE_PERSONALITY } = require('../ai/personality');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thisorthat')
    .setDescription('Post a this-or-that poll')
    .addStringOption(option =>
      option.setName('option_a').setDescription('First option (leave blank for a random one)').setRequired(false))
    .addStringOption(option =>
      option.setName('option_b').setDescription('Second option (leave blank for a random one)').setRequired(false)),

  async execute(interaction) {
    let optionA = interaction.options.getString('option_a');
    let optionB = interaction.options.getString('option_b');

    await interaction.deferReply();

    if (!optionA || !optionB) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 40,
          messages: [
            { role: 'system', content: BASE_PERSONALITY },
            { role: 'user', content: `Give me a fun, silly "this or that" / "would you rather" pair of short options (each under 6 words). Respond ONLY as: OPTION A | OPTION B` },
          ],
        });
        const text = completion.choices[0]?.message?.content?.trim() || '';
        const [a, b] = text.split('|').map(s => s?.trim());
        optionA = optionA || a || 'Pizza';
        optionB = optionB || b || 'Tacos';
      } catch (error) {
        console.error('[thisorthat] OpenAI request failed:', error);
        optionA = optionA || 'Pizza';
        optionB = optionB || 'Tacos';
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🅰️ This or That 🅱️')
      .setColor(0x5865F2)
      .setDescription(`🅰️ **${optionA}**\n\nvs\n\n🅱️ **${optionB}**`)
      .setFooter({ text: `React below to vote!` });

    await interaction.editReply({ embeds: [embed] });
    const message = await interaction.fetchReply();
    await message.react('🅰️');
    await message.react('🅱️');
  },
};