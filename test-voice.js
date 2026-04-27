import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import './src/server/setup-ffmpeg.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.on('raw', (packet) => {
  if (packet.t === 'VOICE_STATE_UPDATE' || packet.t === 'VOICE_SERVER_UPDATE') {
    console.log(`[GW] ${packet.t}:`, JSON.stringify(packet.d));
  }
});

client.on(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guildId = process.argv[2];
  const channelId = process.argv[3];

  if (!guildId || !channelId) {
    console.log('\nUsage: node test-voice.js <guildId> <channelId>');
    for (const [, guild] of client.guilds.cache) {
      for (const [, ch] of guild.channels.cache.filter(c => c.isVoiceBased())) {
        console.log(`  ${guild.name} | ${ch.name} | guild=${guild.id} channel=${ch.id}`);
      }
    }
    process.exit(0);
  }

  const guild = client.guilds.cache.get(guildId);
  console.log(`\nJoining channel ${channelId} in ${guild.name}...`);

  const conn = joinVoiceChannel({
    guildId,
    channelId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  setInterval(() => {
    console.log(`[TICK] Connection state: ${conn.state.status}`);
    const s = conn.state;
    if (s.networking) {
      console.log(`[TICK] Networking: ${JSON.stringify(s.networking.state)}`);
    }
  }, 3000);

  setTimeout(() => {
    console.log('\n--- Final ---');
    console.log('Connection state:', conn.state.status);
    process.exit(0);
  }, 25000);
});

client.login(process.env.DISCORD_TOKEN);
