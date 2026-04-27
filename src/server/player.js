import {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
} from '@discordjs/voice';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');

const durationCache = new Map();

export function getAudioDuration(filePath) {
  if (durationCache.has(filePath)) return Promise.resolve(durationCache.get(filePath));
  return new Promise((resolve) => {
    const args = ['-i', filePath, '-f', 'null', '-'];
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      let dur = 0;
      if (m) dur = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 100;
      durationCache.set(filePath, dur);
      resolve(dur);
    });
    proc.on('error', () => resolve(0));
  });
}

function createSeekableStream(filePath, seekSeconds) {
  const args = [];
  if (seekSeconds > 0) args.push('-ss', String(seekSeconds));
  args.push('-i', filePath, '-analyzeduration', '0', '-loglevel', '0',
    '-f', 's16le', '-ar', '48000', '-ac', '2', '-map', 'a', 'pipe:1');
  const proc = spawn(ffmpegPath, args, { windowsHide: true });
  return proc;
}

export class GuildPlayer {
  constructor(guildId) {
    this.guildId = guildId;
    this.queue = [];
    this.originalQueue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isPaused = false;
    this.volume = 1;
    this.loop = 'none';
    this.shuffled = false;
    this.connection = null;
    this.audioPlayer = createAudioPlayer();
    this.currentResource = null;
    this.currentTrack = null;
    this.currentFilePath = null;
    this.currentDuration = 0;
    this.playbackStartedAt = 0;
    this.totalPausedMs = 0;
    this.pauseStartedAt = 0;
    this.seekOffset = 0;
    this.ffmpegProcess = null;

    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
        this.currentTrack = null;
        this.currentResource = null;
        this.currentFilePath = null;
        this.currentDuration = 0;
        this.playbackStartedAt = 0;
        this.seekOffset = 0;
        this.totalPausedMs = 0;
        this._playNext();
      }
      if (newState.status === AudioPlayerStatus.Playing) {
        this.isPlaying = true;
        this.isPaused = false;
        if (!this.playbackStartedAt) this.playbackStartedAt = Date.now();
      }
      if (newState.status === AudioPlayerStatus.Paused) {
        this.isPaused = true;
        this.pauseStartedAt = Date.now();
      }
    });

    this.audioPlayer.on('error', (error) => {
      console.error(`[Player] Error for ${guildId}:`, error.message);
      this.currentTrack = null;
      this.currentResource = null;
      this._playNext();
    });
  }

  setConnection(connection) {
    this.connection = connection;
    connection.subscribe(this.audioPlayer);
  }

  disconnect() {
    this.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }

  addToQueue(filePath) {
    if (!fs.existsSync(filePath)) return false;
    this.queue.push(filePath);
    this.originalQueue.push(filePath);
    if (this.shuffled) this._shuffleQueue();
    return true;
  }

  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return false;
    const removed = this.queue.splice(index, 1)[0];
    const origIndex = this.originalQueue.indexOf(removed);
    if (origIndex !== -1) this.originalQueue.splice(origIndex, 1);
    if (this.currentIndex >= this.queue.length) {
      this.currentIndex = this.queue.length - 1;
    }
    return true;
  }

  clearQueue() {
    this.queue = [];
    this.originalQueue = [];
    this.currentIndex = -1;
  }

  play(filePath) {
    if (!this.connection) return false;
    const resolved = filePath || this._getNextTrack();
    if (!resolved) return false;
    if (!fs.existsSync(resolved)) return false;

    this.audioPlayer.stop();

    try {
      const proc = createSeekableStream(resolved, 0);
      this.ffmpegProcess = proc;
      const resource = createAudioResource(proc.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });

      resource.volume.setVolume(this.volume);
      this.currentResource = resource;
      this.currentTrack = path.basename(resolved);
      this.currentFilePath = resolved;
      this.currentIndex = this.queue.indexOf(resolved);
      this.seekOffset = 0;
      this.totalPausedMs = 0;
      this.playbackStartedAt = 0;

      getAudioDuration(resolved).then((d) => { this.currentDuration = d; });

      this.audioPlayer.play(resource);
      this.isPlaying = true;
      this.isPaused = false;
      return true;
    } catch (err) {
      console.error('[Player] Error:', err.message);
      return false;
    }
  }

  playNow(filePath) {
    this.addToQueue(filePath);
    const idx = this.queue.length - 1;
    this.currentIndex = idx - 1;
    return this._playNext();
  }

  playQueueIndex(index) {
    if (index < 0 || index >= this.queue.length) return false;
    const track = this.queue[index];
    this.currentIndex = index - 1;
    return this._playNext();
  }

  seekTo(seconds) {
    if (!this.currentFilePath || !this.connection) return false;
    seconds = Math.max(0, Math.min(seconds, this.currentDuration || seconds));

    this.audioPlayer.stop();

    try {
      const proc = createSeekableStream(this.currentFilePath, seconds);
      this.ffmpegProcess = proc;
      const resource = createAudioResource(proc.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });

      resource.volume.setVolume(this.volume);
      this.currentResource = resource;
      this.seekOffset = seconds;
      this.totalPausedMs = 0;
      this.playbackStartedAt = 0;

      this.audioPlayer.play(resource);
      this.isPlaying = true;
      this.isPaused = false;
      return true;
    } catch {
      return false;
    }
  }

  pause() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
      this.audioPlayer.pause();
      return true;
    }
    return false;
  }

  resume() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      if (this.pauseStartedAt) {
        this.totalPausedMs += Date.now() - this.pauseStartedAt;
        this.pauseStartedAt = 0;
      }
      this.audioPlayer.unpause();
      return true;
    }
    return false;
  }

  stop() {
    this.audioPlayer.stop();
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTrack = null;
    this.currentResource = null;
    this.currentFilePath = null;
    this.currentDuration = 0;
    this.playbackStartedAt = 0;
    this.seekOffset = 0;
    this.totalPausedMs = 0;
  }

  skip() {
    this.audioPlayer.stop();
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex -= 2;
      this.audioPlayer.stop();
      return true;
    }
    return false;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(2, vol));
    if (this.currentResource) {
      this.currentResource.volume.setVolume(this.volume);
    }
  }

  setLoop(mode) {
    if (['none', 'track', 'queue'].includes(mode)) {
      this.loop = mode;
      return true;
    }
    return false;
  }

  toggleShuffle() {
    this.shuffled = !this.shuffled;
    if (this.shuffled) {
      this._shuffleQueue();
    } else {
      const currentFile = this.currentIndex >= 0 ? this.queue[this.currentIndex] : null;
      this.queue = [...this.originalQueue];
      if (currentFile) {
        this.currentIndex = this.queue.indexOf(currentFile);
      }
    }
    return this.shuffled;
  }

  getCurrentTime() {
    if (!this.isPlaying && !this.isPaused) return 0;
    let elapsed = 0;
    if (this.playbackStartedAt) {
      elapsed = (Date.now() - this.playbackStartedAt - this.totalPausedMs) / 1000;
      if (this.isPaused && this.pauseStartedAt) {
        elapsed -= (Date.now() - this.pauseStartedAt) / 1000;
      }
    }
    return Math.max(0, this.seekOffset + elapsed);
  }

  getStatus() {
    const currentTime = this.getCurrentTime();
    return {
      guildId: this.guildId,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTrack: this.currentTrack,
      currentDuration: Math.round(this.currentDuration),
      currentTime: Math.round(currentTime),
      currentIndex: this.currentIndex,
      queueLength: this.queue.length,
      queue: this.queue.map((f) => path.basename(f)),
      volume: this.volume,
      loop: this.loop,
      shuffled: this.shuffled,
      connected: !!this.connection,
    };
  }

  _getNextTrack() {
    if (this.queue.length === 0) return null;
    if (this.loop === 'track' && this.currentIndex >= 0) {
      return this.queue[this.currentIndex];
    }
    let nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.queue.length) {
      if (this.loop === 'queue') { nextIndex = 0; } else { return null; }
    }
    this.currentIndex = nextIndex;
    return this.queue[nextIndex];
  }

  _playNext() {
    const prevIndex = this.currentIndex;
    const track = this._getNextTrack();
    if (track) {
      const ok = this.play(track);
      if (!ok) this.currentIndex = prevIndex;
      return ok;
    } else {
      this.isPlaying = false;
      this.currentTrack = null;
      return false;
    }
  }

  _shuffleQueue() {
    const current = this.currentIndex >= 0 ? this.queue[this.currentIndex] : null;
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    if (current) {
      this.currentIndex = this.queue.indexOf(current);
    }
  }
}

export class PlayerManager {
  constructor() {
    this.players = new Map();
  }
  get(guildId) {
    if (!this.players.has(guildId)) {
      this.players.set(guildId, new GuildPlayer(guildId));
    }
    return this.players.get(guildId);
  }
  remove(guildId) {
    const player = this.players.get(guildId);
    if (player) { player.disconnect(); this.players.delete(guildId); }
  }
  has(guildId) { return this.players.has(guildId); }
}
