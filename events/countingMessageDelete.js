// events/countingMessageDelete.js
// If someone counts correctly and then deletes their message to mess up
// the next person, call them out and tell everyone what the next number is.

const CountingState = require('../models/CountingState');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (message.channelId !== process.env.COUNTING_CHANNEL_ID) return;

    const state = await CountingState.findById('counting_state');
    if (!state || !state.lastMessageId || state.lastMessageId !== message.id) return;

    const offenderId = state.lastUserId;

    // Clear it so this can only trigger once per deleted message
    state.lastMessageId = null;
    await state.save();

    const channel = message.channel ?? await message.client.channels.fetch(message.channelId).catch(() => null);
    if (!channel) return;

    await channel.send(`🕵️ <@${offenderId}> deleted their count to purposely mess up the next person! The next number is **${state.currentCount}**.`);
  },
};