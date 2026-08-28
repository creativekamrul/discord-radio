import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
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
  constructor(token, navidrome, audiobookshelf) {
    this.token = token;
    this.navidrome = navidrome;
    this.audiobookshelf = audiobookshelf;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });
    this.playerManager = new PlayerManager((status) => this._updatePresence(status));
    this.playerPanels = new Map();
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
        } else if (interaction.isButton()) {
          await this._handleButton(interaction);
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
    if (status?.guildId) this._updatePlayerPanel(status.guildId);
  }

  _playerPanelPayload(guildId) {
    const player = this.getPlayer(guildId);
    const status = player.getStatus();
    const hasTrack = Boolean(status.currentTrack);
    const playLabel = status.isPaused ? '▶️ Resume' : '⏸ Pause';
    const queue = status.queue
      .slice(Math.max(0, status.currentIndex + 1), Math.max(0, status.currentIndex + 7))
      .map((track, index) => `${index + 1}. ${track}`)
      .join('\n');
    const context = [status.source, status.collection].filter(Boolean).join(' · ');
    const elapsed = this._formatTime(status.currentTime);
    const duration = this._formatTime(status.currentDuration);
    const progress = status.currentDuration ? `${elapsed} / ${duration}` : 'Live / unknown length';

    const embed = new EmbedBuilder()
      .setTitle('🎛️ Radio Bot Player')
      .setColor(status.isPaused ? 0xf0b84b : 0x7c4dff)
      .setDescription(hasTrack ? `**${status.currentTrack}**` : '*Nothing is playing right now.*')
      .addFields(
        { name: 'Source', value: context || '—', inline: true },
        { name: 'Progress', value: progress, inline: true },
        { name: 'Queue', value: queue || 'No upcoming tracks', inline: false },
        { name: 'Playback', value: `${status.loop} loop · ${status.shuffled ? '🔀 shuffle on' : 'shuffle off'} · ${Math.round(status.volume * 100)}% volume${status.sleepTimerSeconds ? ` · 🌙 ${this._formatTime(status.sleepTimerSeconds)}` : ''}`, inline: false },
      )
      .setFooter({ text: 'Use the buttons below to control playback' });

    const button = (customId, label, style = ButtonStyle.Secondary, disabled = false) =>
      new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style).setDisabled(disabled);

    const rows = [
      new ActionRowBuilder().addComponents(
        button('player:previous', '⏮ Previous', ButtonStyle.Secondary, !hasTrack),
        button('player:toggle', playLabel, ButtonStyle.Primary, !hasTrack),
        button('player:stop', '⏹ Stop', ButtonStyle.Danger, !hasTrack),
        button('player:next', '⏭ Next', ButtonStyle.Secondary, !hasTrack),
        button('player:refresh', '🔄 Refresh'),
      ),
      new ActionRowBuilder().addComponents(
        button('player:back30', '↩ 30s', ButtonStyle.Secondary, !hasTrack),
        button('player:forward30', '30s ↪', ButtonStyle.Secondary, !hasTrack),
        button('player:vol-down', '🔉 Vol −'),
        button('player:vol-up', '🔊 Vol +'),
        button('player:shuffle', status.shuffled ? '🔀 Shuffle on' : '🔀 Shuffle'),
      ),
      new ActionRowBuilder().addComponents(
        button('player:loop', `🔁 Loop: ${status.loop}`),
        button('player:sleep:30', '🌙 Sleep 30m'),
        button('player:sleep:60', '🌙 Sleep 60m'),
        button('player:sleep:off', '☀️ Cancel sleep'),
        button('player:clear', '🧹 Clear queue', ButtonStyle.Danger),
      ),
    ];

    return { embeds: [embed], components: rows };
  }

  _formatTime(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, '0');
    if (mins < 60) return `${mins}:${secs}`;
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}:${secs}`;
  }

  async _updatePlayerPanel(guildId) {
    const message = this.playerPanels.get(guildId);
    if (!message) return;
    try {
      await message.edit(this._playerPanelPayload(guildId));
    } catch {
      this.playerPanels.delete(guildId);
    }
  }

  async _registerCommands() {
    const commands = [
      { name: 'join', description: 'Join your voice channel' },
      { name: 'leave', description: 'Leave the voice channel' },
      { name: 'pause', description: 'Pause the current track' },
      { name: 'play', description: 'Resume playback' },
      { name: 'next', description: 'Skip to the next track' },
      { name: 'player', description: 'Open the interactive playback control panel' },
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
      { name: 'books', description: 'Browse Audiobookshelf libraries' },
      {
        name: 'book-search',
        description: 'Search an Audiobookshelf library',
        options: [
          { name: 'query', type: 3, description: 'Book, author, or series to search for', required: true },
        ],
      },
    ];
    try {
      const rest = new REST({ version: '10' }).setToken(this.token);
      // Keep one command scope only. Older versions registered both global and
      // guild commands, which made Discord display every command twice.
      await rest.put(Routes.applicationCommands(this.client.user.id), { body: commands });
      const guilds = [...this.client.guilds.cache.values()];
      await Promise.all(guilds.map((guild) =>
        rest.put(Routes.applicationGuildCommands(this.client.user.id, guild.id), { body: [] })
      ));
      console.log(`[Bot] Registered ${commands.length} global slash commands and cleared commands in ${guilds.length} server(s)`);
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

    else if (commandName === 'player') {
      const message = await interaction.reply({ ...this._playerPanelPayload(interaction.guildId), fetchReply: true });
      this.playerPanels.set(interaction.guildId, message);
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

    else if (commandName === 'books') {
      if (!this.audiobookshelf.available) return interaction.reply({ content: 'Audiobookshelf is not configured.', ephemeral: true });
      await interaction.deferReply();
      const libraries = await this.audiobookshelf.getLibraries();
      const options = libraries.slice(0, 25).map((lib) => ({ label: lib.name.slice(0, 100), value: lib.id, description: lib.mediaType || 'library' }));
      if (!options.length) return interaction.editReply('No Audiobookshelf libraries found.');
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('abs-library').setPlaceholder('Select a library...').addOptions(options));
      interaction.editReply({ content: 'Choose an Audiobookshelf library:', components: [row] });
    }

    else if (commandName === 'book-search') {
      if (!this.audiobookshelf.available) return interaction.reply({ content: 'Audiobookshelf is not configured.', ephemeral: true });
      await interaction.deferReply();
      const libraries = await this.audiobookshelf.getLibraries();
      if (!libraries.length) return interaction.editReply('No Audiobookshelf libraries found.');
      const query = interaction.options.getString('query');
      const results = await Promise.all(libraries.map((library) => this.audiobookshelf.searchLibrary(library.id, query)));
      const entries = results.flatMap((result) => result.book || result.podcast || []).slice(0, 25);
      const options = entries.map((entry) => {
        const item = this.audiobookshelf.normalizeItem(entry.libraryItem || entry);
        return { label: item.title.slice(0, 100), value: item.id, description: item.author.slice(0, 90) };
      });
      if (!options.length) return interaction.editReply(`No Audiobookshelf results for \`${query}\`.`);
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('abs-search').setPlaceholder('Select a book to play...').addOptions(options));
      interaction.editReply({ content: `Audiobookshelf results for **${query}**:`, components: [row] });
    }
  }

  async _handleButton(interaction) {
    if (!interaction.customId.startsWith('player:')) return;
    const player = this.getPlayer(interaction.guildId);
    const action = interaction.customId.slice('player:'.length);

    if (action === 'toggle') {
      if (!player.resume() && !player.pause()) {
        return interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      }
    } else if (action === 'previous') {
      player.previous();
    } else if (action === 'next') {
      player.skip();
    } else if (action === 'stop') {
      player.stop();
    } else if (action === 'refresh') {
      // Refresh only; no player state change is needed.
    } else if (action === 'back30' || action === 'forward30') {
      const delta = action === 'back30' ? -30 : 30;
      player.seekTo(player.getCurrentTime() + delta);
    } else if (action === 'vol-down' || action === 'vol-up') {
      const delta = action === 'vol-down' ? -0.1 : 0.1;
      player.setVolume(player.getStatus().volume + delta);
    } else if (action === 'shuffle') {
      player.toggleShuffle();
    } else if (action === 'loop') {
      const next = { none: 'queue', queue: 'track', track: 'none' }[player.getStatus().loop] || 'none';
      player.setLoop(next);
    } else if (action === 'clear') {
      player.clearQueue();
    } else if (action.startsWith('sleep:')) {
      const value = action.slice('sleep:'.length);
      if (value === 'off') player.cancelSleepTimer();
      else player.setSleepTimer(Number(value));
    }

    await interaction.update(this._playerPanelPayload(interaction.guildId));
    this.playerPanels.set(interaction.guildId, interaction.message);
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

    else if (interaction.customId === 'abs-library') {
      await interaction.deferUpdate();
      const libraryId = interaction.values[0];
      const result = await this.audiobookshelf.getLibraryItems(libraryId, { sort: 'media.metadata.title' });
      const items = (result.results || []).slice(0, 25).map((item) => this.audiobookshelf.normalizeItem(item));
      const options = items.map((item) => ({
        label: item.title.slice(0, 100),
        value: item.id,
        description: `${item.mediaType === 'podcast' ? 'Podcast' : 'Book'} · ${item.author}`.slice(0, 100),
      }));
      if (!options.length) return await interaction.editReply({ content: 'That Audiobookshelf library has no playable items.', components: [] });
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('abs-book').setPlaceholder('Select a book or podcast...').addOptions(options));
      await interaction.editReply({ content: `Items in **${libraryId}**:`, components: [row] });
    }

    else if (interaction.customId === 'abs-search') {
      const itemId = interaction.values[0];
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) return interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
      if (!getVoiceConnection(interaction.guildId)) this.joinChannel(interaction.guildId, voiceChannel.id);
      await interaction.deferUpdate();
      const title = await this._playAudiobook(interaction.guildId, itemId);
      interaction.editReply(title ? `▶️ Playing **${title}**` : '❌ Failed to play audiobook');
    }

    else if (interaction.customId === 'abs-book') {
      const itemId = interaction.values[0];
      const item = await this.audiobookshelf.getItem(itemId);
      if (item.mediaType === 'podcast') {
        const episodes = (item.media?.episodes || []).slice(0, 25);
        const options = episodes.map((episode, index) => ({
          label: `${episode.episode || index + 1}. ${episode.title || episode.displayTitle || 'Untitled episode'}`.slice(0, 100),
          value: episode.id,
          description: `${episode.season ? `S${episode.season} · ` : ''}${Math.round(episode.duration || episode.audioTrack?.duration || 0)} seconds`,
        }));
        await interaction.deferUpdate();
        if (!options.length) return await interaction.editReply({ content: 'No downloaded episodes are available for this podcast.', components: [] });
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`abs-episode:${itemId}`).setPlaceholder('Select an episode to play...').addOptions(options));
        return await interaction.editReply({ content: `Episodes in **${item.media?.metadata?.title || 'podcast'}**:`, components: [row] });
      }
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) return interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
      if (!getVoiceConnection(interaction.guildId)) this.joinChannel(interaction.guildId, voiceChannel.id);
      await interaction.deferUpdate();
      const title = await this._playAudiobook(interaction.guildId, itemId);
      interaction.editReply(title ? `▶️ Playing **${title}**` : '❌ Failed to play audiobook');
    }

    else if (interaction.customId.startsWith('abs-episode:')) {
      const itemId = interaction.customId.slice('abs-episode:'.length);
      const episodeId = interaction.values[0];
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) return interaction.reply({ content: 'You need to be in a voice channel first!', ephemeral: true });
      if (!getVoiceConnection(interaction.guildId)) this.joinChannel(interaction.guildId, voiceChannel.id);
      await interaction.deferUpdate();
      const title = await this._playAudiobook(interaction.guildId, itemId, episodeId);
      interaction.editReply(title ? `▶️ Playing **${title}**` : '❌ Failed to play episode');
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
        player.addToQueueUrl(streamUrl, title, song.duration, { source: 'Navidrome', collection: pl.name });
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
    player.playNowUrl(streamUrl, title, song.duration, { source: 'Navidrome' });
    return title;
  }

  async _playAudiobook(guildId, itemId, episodeId) {
    const item = await this.audiobookshelf.getItem(itemId);
    const session = await this.audiobookshelf.startPlayback(itemId, episodeId);
    const episode = episodeId ? (item.media?.episodes || []).find((entry) => entry.id === episodeId) : null;
    const title = episode?.title || episode?.displayTitle || item.media?.metadata?.title || 'Audiobook';
    const player = this.playerManager.get(guildId);
    player.clearQueue();
    for (const track of session.audioTracks || []) {
      player.addToQueueUrl(track.contentUrl, `${title}${track.title ? ` — ${track.title}` : ''}`, track.duration, { source: 'Audiobookshelf', collection: title });
    }
    player.play();
    return title;
  }
}
