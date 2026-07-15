// utils/categoryCheck.js
// Checks whether a message's channel belongs to the specific category
// the bot should be "watching" for its chat-based AI features.

function isInWatchedCategory(message) {
  const watchedCategoryId = process.env.WATCHED_CATEGORY_ID?.trim();
  if (!watchedCategoryId) return true; // if not configured, don't restrict anything

  return message.channel.parentId === watchedCategoryId;
}

module.exports = { isInWatchedCategory };