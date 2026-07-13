// events/ready.js
// Fires once when the bot successfully logs in and is ready to go.
// Sets the bot's Discord status/presence, and auto-registers slash
// commands IF the DEPLOY_COMMANDS env var is set to "true" - so you
// don't have to run deploy-commands.js manually every time.

const { ActivityType, REST, Routes } = require('discord.js');

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

    // Auto-register slash commands on startup, only if explicitly enabled
    if (process.env.DEPLOY_COMMANDS === 'true') {
      try {
        const commands = client.commands.map(cmd => cmd.data.toJSON());
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);

        console.log(`[deploy] Registering ${commands.length} slash command(s)...`);
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
          { body: commands },
        );
        console.log('[deploy] Slash commands registered successfully.');
      } catch (error) {
        console.error('[deploy] Failed to register commands:', error);
      }
    }
  },
};