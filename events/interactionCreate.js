// events/interactionCreate.js
// Runs whenever someone uses a slash command OR clicks a button.

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // --- Slash commands ---
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`[WARNING] No command matching "${interaction.commandName}" was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing command "${interaction.commandName}":`, error);
        const errorMessage = { content: 'There was an error running this command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
      return;
    }

    // --- Music control panel buttons ---
    if (interaction.isButton() && interaction.customId.startsWith('music_')) {
      const { handleMusicButton } = require('../music/controlPanel');
      try {
        await handleMusicButton(interaction);
      } catch (error) {
        console.error('Error handling music button:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Something went wrong with that button.', ephemeral: true });
        }
      }
    }
  },
};