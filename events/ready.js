@'
// events/ready.js
// Fires once when the bot successfully logs in and is ready to go.
// Sets the bot's Discord status/presence.
const { ActivityType } = require('discord.js');
module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[ready] Logged in as ${client.user.tag}`);
    client.user.setPresence({
      activities: [
        {
          name: `Watching all of Kavia's minions`,
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });
  },
};
'@ | Set-Content events\ready.js