// music/controlPanel.js
// Builds the button row shown under "now playing" embeds, and handles
// what happens when someone clicks one of those buttons.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { useQueue } = require('discord-player');

function buildControlRow(queue) {
  const isPaused = queue?.node?.isPaused() ?? false;
  const repeatMode = queue?.repeatMode ?? 0; // 0 = off, 1 = track, 3 = queue

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_pauseresume')
      .setEmoji(isPaused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('music_shuffle')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setEmoji('🔁')
      .setStyle(repeatMode !== 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
  );
}

async function handleMusicButton(interaction) {
  const queue = useQueue(interaction.guild.id);

  if (!queue || !queue.currentTrack) {
    return interaction.reply({ content: `Nothing is playing right now.`, ephemeral: true });
  }

  // Must be in the same voice channel as the bot to control it
  const memberVoiceChannel = interaction.member.voice.channel;
  if (!memberVoiceChannel || memberVoiceChannel.id !== queue.channel.id) {
    return interaction.reply({ content: `You need to be in the voice channel to control playback.`, ephemeral: true });
  }

  switch (interaction.customId) {
    case 'music_pauseresume': {
      const isPaused = queue.node.isPaused();
      queue.node.setPaused(!isPaused);
      await interaction.reply({ content: isPaused ? `▶️ Resumed.` : `⏸️ Paused.`, ephemeral: true });
      break;
    }

    case 'music_skip': {
      const skippedTrack = queue.currentTrack;
      queue.node.skip();
      await interaction.reply({ content: `⏭️ Skipped **${skippedTrack.title}**.`, ephemeral: true });
      break;
    }

    case 'music_stop': {
      queue.delete();
      await interaction.reply({ content: `⏹️ Stopped playback and cleared the queue.`, ephemeral: true });
      break;
    }

    case 'music_shuffle': {
      queue.tracks.shuffle();
      await interaction.reply({ content: `🔀 Queue shuffled.`, ephemeral: true });
      break;
    }

    case 'music_loop': {
      const isLooping = queue.repeatMode !== 0;
      queue.setRepeatMode(isLooping ? 0 : 3); // toggle between off and "loop queue"
      await interaction.reply({ content: isLooping ? `🔁 Loop disabled.` : `🔁 Looping the queue.`, ephemeral: true });
      break;
    }
  }
}

module.exports = { buildControlRow, handleMusicButton };