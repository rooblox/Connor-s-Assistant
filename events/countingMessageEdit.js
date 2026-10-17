// events/countingMessageEdit.js
// If someone counts correctly and then EDITS their message to a different
// number to mess up the next person, call them out - same as deleting.

const CountingState = require('../models/CountingState');
const { tryEvaluateMath } = require('./countingGame');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (newMessage.channelId !== process.env.COUNTING_CHANNEL_ID) return;
    if (newMessage.author?.bot) return;

    const state = await CountingState.findById('counting_state');
    if (!state || !state.lastMessageId || state.lastMessageId !== newMessage.id) return;

    // Message wasn't cached - fetch it so we can read the new content
    if (newMessage.partial) {
      newMessage = await newMessage.fetch().catch(() => null);
      if (!newMessage) return;
    }

    // Link previews and embeds fire this event with no real text change
    if (oldMessage?.content != null && oldMessage.content === newMessage.content) return;

    // Editing to something that still equals the counted number is fine (e.g. "5" -> "2+3")
    const countedNumber = state.currentCount - 1;
    const newValue = tryEvaluateMath(newMessage.content ?? '');
    if (newValue === countedNumber) return;

    const offenderId = state.lastUserId;

    // Clear it so this can only trigger once per message
    state.lastMessageId = null;
    await state.save();

    const channel = newMessage.channel ?? await newMessage.client.channels.fetch(newMessage.channelId).catch(() => null);
    if (!channel) return;

    await channel.send(`✏️ <@${offenderId}> edited their count to purposely mess up the next person! The next number is **${state.currentCount}**.`);
  },
};