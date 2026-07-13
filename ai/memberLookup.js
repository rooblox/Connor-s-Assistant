// ai/memberLookup.js
// Scans a message for words that match a real server member's username or
// nickname, so the AI treats it as "that Discord member" instead of
// potentially confusing them with an unrelated public figure.

function findMentionedMembers(guild, text) {
  if (!guild) return [];

  // Pull out "word-like" chunks from the message to check against member names
  const words = text.match(/[A-Za-z0-9_.]+/g) || [];
  if (words.length === 0) return [];

  const lowerWords = new Set(words.map(w => w.toLowerCase()));
  const matches = [];

  for (const [, member] of guild.members.cache) {
    const username = member.user.username.toLowerCase();
    const nickname = member.nickname ? member.nickname.toLowerCase() : null;
    const globalName = member.user.globalName ? member.user.globalName.toLowerCase() : null;

    if (
      lowerWords.has(username) ||
      (nickname && lowerWords.has(nickname)) ||
      (globalName && lowerWords.has(globalName))
    ) {
      matches.push({
        id: member.id,
        displayName: member.displayName,
        username: member.user.username,
        roles: member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name),
      });
    }
  }

  return matches;
}

module.exports = { findMentionedMembers };