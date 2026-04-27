import { Client, GatewayIntentBits } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  getVoiceConnection,
} from '@discordjs/voice';
import { PlayerManager } from './player.js';
import os from 'os';

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && name.startsWith('Ethernet')) {
        return net.address;
      }
    }
  }
  return undefined;
}

export class RadioBot {
  constructor(token) {
    this.token = token;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });
    this.playerManager = new PlayerManager();
    this.ready = false;

    this.client.once('ready', () => {
      console.log(`[Bot] Logged in as ${this.client.user.tag}`);
      this.ready = true;
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      if (newState.id === this.client.user.id && !newState.channelId) {
        const player = this.playerManager.get(newState.guild.id);
        player.stop();
        player.connection = null;
      }
    });
  }

  async start() {
    if (!this.token) throw new Error('No token provided');
    await this.client.login(this.token);
    return new Promise((resolve) => {
      if (this.ready) return resolve();
      this.client.once('ready', () => resolve());
    });
  }

  getGuilds() {
    if (!this.ready) return [];
    return this.client.guilds.cache.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL(),
    }));
  }

  getVoiceChannels(guildId) {
    if (!this.ready) return [];
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return [];
    return guild.channels.cache
      .filter((ch) => ch.isVoiceBased())
      .map((ch) => ({
        id: ch.id,
        name: ch.name,
        members: ch.members.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  joinChannel(guildId, channelId) {
    if (!this.ready) return { error: 'Bot is not connected to Discord' };
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return { error: 'Guild not found' };

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isVoiceBased()) return { error: 'Voice channel not found' };

    const existing = getVoiceConnection(guildId);
    if (existing) existing.destroy();

    const localIp = getLocalIp();
    const connection = joinVoiceChannel({
      guildId,
      channelId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    connection.on('debug', (msg) => console.log(`[Bot:Debug] ${msg}`));

    const player = this.playerManager.get(guildId);
    player.setConnection(connection);

    connection.on('stateChange', (oldState, newState) => {
      console.log(`[Bot] Connection: ${oldState.status} -> ${newState.status}`);
      if (newState.status === VoiceConnectionStatus.Connecting && newState.networking) {
        const net = newState.networking;
        net.on('stateChange', (o, n) => {
          console.log(`[Bot:Net] ${o.code} -> ${n.code}`);
        });
        net.on('close', (code) => {
          console.log(`[Bot:Net] CLOSED with code: ${code}`);
          const reasons = {4001:'Unknown opcode',4002:'Decode error',4003:'Not authenticated',4004:'Auth failed',4005:'Already authenticated',4006:'Session invalid',4009:'Session timeout',4011:'Server not found',4012:'Unknown protocol',4014:'Disconnected',4015:'Voice disconnected',4016:'Unknown encryption'};
          console.log(`[Bot:Net] Reason: ${reasons[code] || 'Unknown'}`);
        });
        net.on('error', (err) => {
          console.log(`[Bot:Net] ERROR: ${err.message}`);
        });
      }
      if (newState.status === VoiceConnectionStatus.Signalling && oldState.status === VoiceConnectionStatus.Connecting) {
        console.log('[Bot] Voice connection failed, retrying...');
      }
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      player.stop();
      player.connection = null;
      try { connection.destroy(); } catch {}
    });

    return { success: true, channel: channel.name };
  }

  leaveChannel(guildId) {
    if (!this.ready) return { error: 'Bot is not connected to Discord' };
    const connection = getVoiceConnection(guildId);
    if (connection) {
      this.playerManager.remove(guildId);
      return { success: true };
    }
    return { error: 'Not connected to a voice channel' };
  }

  getPlayer(guildId) {
    return this.playerManager.get(guildId);
  }

  getConnectedChannel(guildId) {
    if (!this.ready) return null;
    const connection = getVoiceConnection(guildId);
    if (!connection) return null;
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;
    const channelId = connection.joinConfig.channelId;
    const channel = guild.channels.cache.get(channelId);
    return channel ? { id: channel.id, name: channel.name } : null;
  }
}
