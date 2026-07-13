require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const mongoose = require('mongoose');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

// Point discord-player at the ffmpeg binary bundled by ffmpeg-static,
// so nobody needs to install ffmpeg system-wide.
process.env.FFMPEG_PATH = require('ffmpeg-static');

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('[mongo] Connected successfully.'))
  .catch(err => console.error('[mongo] Connection failed:', err));

// --- Client setup ---
// Intents = which categories of events Discord will send us.
// We only request what we actually need.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,            // needed for basically everything (slash commands, roles, etc)
    GatewayIntentBits.GuildMessages,      // needed to see messages (counting game, rival bot watcher)
    GatewayIntentBits.MessageContent,     // needed to read message TEXT content (must also be enabled in Dev Portal)
    GatewayIntentBits.GuildVoiceStates,   // needed for music playback
  ],
  partials: [Partials.Message, Partials.Channel],
});

// --- Music player setup ---
// The Player is the engine that handles voice connections, queues, and audio.
// We attach it to the client so any command/event can reach it via client.player
const player = new Player(client);
client.player = player;

// Load extractors - these know how to resolve YouTube/Spotify/SoundCloud links
// into actually playable audio streams
(async () => {
  await player.extractors.loadMulti(DefaultExtractors);
  console.log('[music] Extractors loaded.');
})();
// Log any playback errors so we can actually see what's going wrong
player.events.on('error', (queue, error) => {
  console.error(`[music] General player error in guild ${queue.guild.id}:`, error);
});
player.events.on('playerError', (queue, error) => {
  console.error(`[music] Player error while streaming in guild ${queue.guild.id}:`, error);
});

// Collection to hold all our slash commands, keyed by command name
client.commands = new Collection();

// --- Load commands from /commands folder ---
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[WARNING] Command file ${file} is missing "data" or "execute".`);
    }
  }
}

// --- Load events from /events folder ---
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

client.login(process.env.DISCORD_TOKEN);