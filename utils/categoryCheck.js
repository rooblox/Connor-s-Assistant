// utils/categoryCheck.js
// Checks whether a message's channel belongs to the specific category
// the bot should be "watching" for its chat-based AI features.

function isInWatchedCategory(message) {
  const watchedCategoryId = process.env.WATCHED_CATEGORY_ID;
  if (!watchedCategoryId) return true; // if not configured, don't restrict anything

  const result = message.channel.parentId === watchedCategoryId;
  console.log(`[category-check] channel parentId: "${message.channel.parentId}" | watched: "${watchedCategoryId}" | match: ${result}`);
  return result;
}

module.exports = { isInWatchedCategory };