import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
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
  constructor(token, navidrome) {
    this.token = token;
    this.navidrome = navidrome;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });
    this.playerManager = new PlayerManager((status) => this._updatePresence(status));
    this.ready = false;

    this.client.once('ready', () => {
      console.log(`[Bot] Logged in as ${this.client.user.tag}`);
      this.ready = true;
      this._registerCommands();
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      if (newState.id === this.client.user.id && !newState.channelId) {
        const player = this.playerManager.get(newState.guild.id);
        player.stop();
        player.connection = null;
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this._handleCommand(interaction);
        } else if (interaction.isStringSelectMenu()) {
          await this._handleSelectMenu(interaction);
        }
      } catch (err) {
        console.error('[Bot] Interaction error:', err.message);
        const payload = { content: `Error: ${err.message}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
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

  _updatePresence(status) {
    if (!this.ready || !this.client.user) return;
    if (status && status.isPlaying && status.currentTrack) {
      this.client.user.setActivity(status.currentTrack, { type: 2 });
    } else if (status && status.isPaused && status.currentTrack) {
      this.client.user.setActivity(`⏸ ${status.currentTrack}`, { type: 2 });
    } else {
      this.client.user.setActivity('🎵 nothing', { type: 2 });
    }
  }

  async _registerCommands() {
    const commands = [
      { name: 'join', description: 'Join your voice channel' },
      { name: 'leave', description: 'Leave the voice channel' },
      { name: 'pause', description: 'Pause the current track' },
      { name: 'play', description: 'Resume playback' },
      { name: 'next', description: 'Skip to the next track' },
      {
        name: 'search',
        description: 'Search for a song in Navidrome and play it',
        options: [
          { name: 'query', type: 3, description: 'Song name or artist to search for', required: true },
        ],
      },
      { name: 'see-playlists', description: 'Show Navidrome playlists' },
      {
        name: 'play-playlist',
        description: 'Play a Navidrome playlist by ID',
        options: [
          { name: 'id', type: 3, description: 'Playlist ID (use /see-playlists to find it)', required: true },
        ],
      },
    ];
    try {
      const rest = new REST({ version: '10' }).setToken(this.token);
      await rest.put(Routes.applicationCommands(this.client.user.id), { body: commands });
      console.log(`[Bot] Registered ${commands.length} slash commands`);
    } catch (err) {
      console.error('[Bot] Failed to register commands:', err.message);
    }
  }

  async _handleCommand(interaction) {
    const { commandName } = interaction;

    if (commandName === 'join') {
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
      }
      const result = this.joinChannel(interaction.guildId, voiceChannel.id);
      if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
      interaction.reply(`✅ Joined **${voiceChannel.name}**`);
    }

    else if (commandName === 'leave') {
      const connection = getVoiceConnection(interaction.guildId);
      if (!connection) return interaction.reply({ content: 'I am not in a voice channel.', ephemeral: true });
      this.leaveChannel(interaction.guildId);
      interaction.reply('👋 Left the voice channel');
    }

    else if (commandName === 'pause') {
      const connection = getVoiceConnection(interaction.guildId);
      if (!connection) return interaction.reply({ content: 'I am not in a voice channel.', ephemeral: true });
      const ok = this.getPlayer(interaction.guildId).pause();
      if (!ok) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
      interaction.reply('⏸ Paused');
    }

    else if (commandName === 'play') {
      const connection = getVoiceConnection(interaction.guildId);
      if (!connection) return interaction.reply({ content: 'I am not in a voice channel.', ephemeral: true });
      const ok = this.getPlayer(interaction.guildId).resume();
      if (!ok) return interaction.reply({ content: 'Nothing is paused right now.', ephemeral: true });
      interaction.reply('▶️ Resumed');
    }

    else if (commandName === 'next') {
      const connection = getVoiceConnection(interaction.guildId);
      if (!connection) return interaction.reply({ content: 'I am not in a voice channel.', ephemeral: true });
      this.getPlayer(interaction.guildId).skip();
      interaction.reply('⏭ Skipped to the next track');
    }

    else if (commandName === 'see-playlists') {
      if (!this.navidrome.available) {
        return interaction.reply({ content: 'Navidrome is not configured.', ephemeral: true });
      }
      await interaction.deferReply();
      const playlists = await this.navidrome.getPlaylists();
      if (playlists.length === 0) {
        return interaction.editReply('No playlists found in Navidrome.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🎵 Navidrome Playlists')
        .setColor(0x1db954)
        .setDescription(playlists.map((p) => `**${p.name}** — ${p.songCount} songs \`id: ${p.id}\``).join('\n'));

      const options = playlists.slice(0, 25).map((p) => ({
        label: p.name.length > 100 ? p.name.slice(0, 97) + '...' : p.name,
        value: p.id,
        description: `${p.songCount} songs`,
      }));
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('navidrome-playlist')
          .setPlaceholder('Select a playlist to play...')
          .addOptions(options)
      );

      interaction.editReply({ embeds: [embed], components: [row] });
    }

    else if (commandName === 'play-playlist') {
      const playlistId = interaction.options.getString('id');
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
      }
      if (!getVoiceConnection(interaction.guildId)) {
        this.joinChannel(interaction.guildId, voiceChannel.id);
      }
      await interaction.deferReply();
      await this._playPlaylist(interaction.guildId, playlistId);
      interaction.editReply(`▶️ Playing playlist \`${playlistId}\``);
    }

    else if (commandName === 'search') {
      if (!this.navidrome.available) {
        return interaction.reply({ content: 'Navidrome is not configured.', ephemeral: true });
      }
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
      }
      await interaction.deferReply();
      const query = interaction.options.getString('query');
      const results = await this.navidrome.search(query);
      if (results.songs.length === 0) {
        return interaction.editReply(`No songs found for \`${query}\`.`);
      }

      const songs = results.songs.slice(0, 25);
      const embed = new EmbedBuilder()
        .setTitle('🔍 Search Results')
        .setColor(0x1db954)
        .setDescription(songs.map((s) => `**${s.title}** — ${s.artist}`).join('\n'));

      const options = songs.map((s) => ({
        label: s.title.length > 100 ? s.title.slice(0, 97) + '...' : s.title,
        value: s.id,
        description: s.artist,
      }));
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('navidrome-search')
          .setPlaceholder('Select a song to play...')
          .addOptions(options)
      );

      interaction.editReply({ embeds: [embed], components: [row] });
    }
  }

  async _handleSelectMenu(interaction) {
    if (interaction.customId === 'navidrome-playlist') {
      const playlistId = interaction.values[0];
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
      }
      if (!getVoiceConnection(interaction.guildId)) {
        this.joinChannel(interaction.guildId, voiceChannel.id);
      }
      await interaction.deferUpdate();
      await this._playPlaylist(interaction.guildId, playlistId);
      interaction.editReply(`▶️ Playing playlist \`${playlistId}\``);
    }

    else if (interaction.customId === 'navidrome-search') {
      const songId = interaction.values[0];
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
      }
      if (!getVoiceConnection(interaction.guildId)) {
        this.joinChannel(interaction.guildId, voiceChannel.id);
      }
      await interaction.deferUpdate();
      const title = await this._playSong(interaction.guildId, songId);
      interaction.editReply(title ? `▶️ Playing **${title}**` : '❌ Failed to play song');
    }
  }

  async _playPlaylist(guildId, playlistId) {
    const pl = await this.navidrome.getPlaylist(playlistId);
    const player = this.playerManager.get(guildId);
    player.clearQueue();
    for (const song of pl.songs) {
      const streamUrl = this.navidrome.getStreamUrl(song.id);
      if (streamUrl) {
        const title = `${song.artist} - ${song.title}`;
        player.addToQueueUrl(streamUrl, title, song.duration);
      }
    }
    player.play();
  }

  async _playSong(guildId, songId) {
    const song = await this.navidrome.getSong(songId);
    const streamUrl = this.navidrome.getStreamUrl(songId);
    if (!streamUrl) return null;
    const title = `${song.artist} - ${song.title}`;
    const player = this.playerManager.get(guildId);
    player.playNowUrl(streamUrl, title, song.duration);
    return title;
  }
}
