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

function createUrlStream(url, seekSeconds) {
  const args = [];
  if (seekSeconds > 0) args.push('-ss', String(seekSeconds));
    args.push('-i', url, '-analyzeduration', '0', '-loglevel', 'error',
    '-f', 's16le', '-ar', '48000', '-ac', '2', '-map', 'a', 'pipe:1');
  const proc = spawn(ffmpegPath, args, { windowsHide: true });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d.toString(); });
  proc.on('error', (err) => { console.error(`[FFmpeg URL] spawn error: ${err.message}`); });
  proc.on('close', (code, signal) => {
    const expectedClose = signal === 'SIGTERM' || signal === 'SIGKILL' || /Connection reset by peer|Broken pipe|Error muxing a packet/i.test(stderr);
    if (code && code !== 0 && !expectedClose) console.error(`[FFmpeg URL] exit code ${code}: ${stderr}`);
  });
  return proc;
}

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

function stopFfmpegProcess(proc) {
  if (proc && !proc.killed) {
    try { proc.kill(); } catch {}
  }
}

export class GuildPlayer {
  constructor(guildId, onStatusChange, onPlaybackEvent) {
    this.guildId = guildId;
    this.onStatusChange = onStatusChange;
    this.onPlaybackEvent = onPlaybackEvent;
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
    this.currentSource = null;
    this.currentCollection = null;
    this.currentAbsSessionId = null;
    this.currentAbsItemId = null;
    this.currentAbsEpisodeId = null;
    this.currentAbsOffset = 0;
    this.currentAbsDuration = 0;
    this.currentNavidromeSongId = null;
    this.playbackStartedAt = 0;
    this.totalPausedMs = 0;
    this.pauseStartedAt = 0;
    this.seekOffset = 0;
    this.ffmpegProcess = null;
    this.sleepTimer = null;
    this.sleepTimerEndsAt = 0;

    this._emitStatus = () => {
      if (this.onStatusChange) this.onStatusChange(this.getStatus());
    };

    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
        const ended = this._getPlaybackMetadata();
        const hasNext = this.queue.length > 0 && (this.loop === 'queue' || this.currentIndex + 1 < this.queue.length);
        this.currentTrack = null;
        this.currentResource = null;
        this.currentFilePath = null;
        this.currentDuration = 0;
        this.currentSource = null;
        this.currentCollection = null;
        this.currentAbsSessionId = null;
        this.currentAbsItemId = null;
        this.currentAbsEpisodeId = null;
        this.currentAbsOffset = 0;
        this.currentAbsDuration = 0;
        this.currentNavidromeSongId = null;
        this.playbackStartedAt = 0;
        this.seekOffset = 0;
        this.totalPausedMs = 0;
        this._emitStatus();
        const startedNext = this._playNext();
        if (ended) this.onPlaybackEvent?.(startedNext || hasNext ? 'track-ended' : 'session-ended', ended);
      }
      if (newState.status === AudioPlayerStatus.Playing) {
        this.isPlaying = true;
        this.isPaused = false;
        if (!this.playbackStartedAt) this.playbackStartedAt = Date.now();
        this._emitStatus();
      }
      if (newState.status === AudioPlayerStatus.Paused) {
        this.isPaused = true;
        this.pauseStartedAt = Date.now();
        this._emitStatus();
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
    this.queue.push({ type: 'file', path: filePath });
    this.originalQueue.push({ type: 'file', path: filePath });
    if (this.shuffled) this._shuffleQueue();
    return true;
  }

  addToQueueUrl(url, title, duration, meta = {}) {
    const item = { type: 'url', url, title, duration: duration || 0, ...meta };
    this.queue.push(item);
    this.originalQueue.push({ ...item });
    if (this.shuffled) this._shuffleQueue();
    return true;
  }

  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return false;
    const removed = this.queue.splice(index, 1)[0];
    const origIndex = this.originalQueue.findIndex(
      (t) => t.type === removed.type && (t.path || t.url) === (removed.path || removed.url)
    );
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

  play(item) {
    if (!this.connection) return false;
    const resolved = item || this._getNextTrack();
    if (!resolved) return false;

    if (resolved.type === 'url') {
      return this._playUrl(resolved.url, resolved.title, resolved.duration, resolved);
    }

    if (!fs.existsSync(resolved.path)) return false;

    stopFfmpegProcess(this.ffmpegProcess);
    this.ffmpegProcess = null;
    this.audioPlayer.stop();

    try {
      const proc = createSeekableStream(resolved.path, 0);
      this.ffmpegProcess = proc;
      const resource = createAudioResource(proc.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });

      resource.volume.setVolume(this.volume);
      this.currentResource = resource;
      this.currentTrack = path.basename(resolved.path);
      this.currentFilePath = resolved.path;
      this.currentSource = 'Local files';
      this.currentCollection = null;
      this.currentAbsSessionId = null;
      this.currentAbsItemId = null;
      this.currentAbsEpisodeId = null;
      this.currentAbsOffset = 0;
      this.currentAbsDuration = 0;
      this.currentNavidromeSongId = null;
      this.currentIndex = this.queue.indexOf(resolved);
      this.seekOffset = 0;
      this.totalPausedMs = 0;
      this.playbackStartedAt = 0;

      getAudioDuration(resolved.path).then((d) => { this.currentDuration = d; });

      this.audioPlayer.play(resource);
      this.isPlaying = true;
      this.isPaused = false;
      return true;
    } catch (err) {
      console.error('[Player] Error:', err.message);
      return false;
    }
  }

  _playUrl(url, title, duration, meta = {}) {
    if (!this.connection) return false;

    stopFfmpegProcess(this.ffmpegProcess);
    this.ffmpegProcess = null;
    this.audioPlayer.stop();

    try {
      const initialSeek = Math.max(0, Number(meta.absStartOffset) || 0);
      meta.absStartOffset = 0;
      const proc = createUrlStream(url, initialSeek);
      this.ffmpegProcess = proc;
      const resource = createAudioResource(proc.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });

      resource.volume.setVolume(this.volume);
      this.currentResource = resource;
      this.currentTrack = title || url;
      this.currentFilePath = url;
      this.currentDuration = duration || 0;
      this.currentSource = meta.source || null;
      this.currentCollection = meta.collection || null;
      this.currentAbsSessionId = meta.absSessionId || null;
      this.currentAbsItemId = meta.absItemId || null;
      this.currentAbsEpisodeId = meta.absEpisodeId || null;
      this.currentAbsOffset = Number(meta.absOffset) || 0;
      this.currentAbsDuration = Number(meta.absDuration) || Number(duration) || 0;
      this.currentNavidromeSongId = meta.navidromeSongId || null;
      this.seekOffset = initialSeek;
      this.totalPausedMs = 0;
      this.playbackStartedAt = 0;

      this.audioPlayer.play(resource);
      this.isPlaying = true;
      this.isPaused = false;
      this.onPlaybackEvent?.('track-start', this._getPlaybackMetadata());
      return true;
    } catch (err) {
      console.error('[Player] URL stream error:', err.message);
      return false;
    }
  }

  playNow(filePath) {
    this.addToQueue(filePath);
    const idx = this.queue.length - 1;
    this.currentIndex = idx - 1;
    return this._playNext();
  }

  playNowUrl(url, title, duration, meta = {}) {
    this.addToQueueUrl(url, title, duration, meta);
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
    const currentItem = this.currentIndex >= 0 ? this.queue[this.currentIndex] : null;
    if (this.currentAbsSessionId) {
      const total = this.currentAbsDuration || this.currentDuration;
      seconds = total ? Math.max(0, Math.min(seconds, total)) : Math.max(0, seconds);
      const targetIndex = this.queue.findIndex((track) => {
        const start = Number(track.absOffset) || 0;
        const end = start + (Number(track.duration) || 0);
        return seconds >= start && (seconds < end || track === this.queue[this.queue.length - 1]);
      });
      if (targetIndex >= 0 && targetIndex !== this.currentIndex) {
        this.queue[targetIndex].absStartOffset = Math.max(0, seconds - (Number(this.queue[targetIndex].absOffset) || 0));
        this.currentIndex = targetIndex - 1;
        stopFfmpegProcess(this.ffmpegProcess);
        this.ffmpegProcess = null;
        this.audioPlayer.stop();
        return this._playNext();
      }
      seconds = Math.max(0, seconds - (Number(currentItem?.absOffset) || 0));
    } else if (this.currentDuration) {
      seconds = Math.max(0, Math.min(seconds, this.currentDuration));
    }

    stopFfmpegProcess(this.ffmpegProcess);
    this.ffmpegProcess = null;
    this.audioPlayer.stop();

    try {
       const isUrl = currentItem?.type === 'url';
      const proc = isUrl
        ? createUrlStream(this.currentFilePath, seconds)
        : createSeekableStream(this.currentFilePath, seconds);
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
      this.onPlaybackEvent?.('pause', this._getPlaybackMetadata());
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
    this.onPlaybackEvent?.('stop', this._getPlaybackMetadata());
    this.cancelSleepTimer();
    stopFfmpegProcess(this.ffmpegProcess);
    this.ffmpegProcess = null;
    this.audioPlayer.stop();
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTrack = null;
    this.currentResource = null;
    this.currentFilePath = null;
    this.currentDuration = 0;
    this.currentSource = null;
    this.currentCollection = null;
    this.currentAbsSessionId = null;
    this.currentAbsItemId = null;
    this.currentAbsEpisodeId = null;
    this.currentAbsOffset = 0;
    this.currentAbsDuration = 0;
    this.currentNavidromeSongId = null;
    this.playbackStartedAt = 0;
    this.seekOffset = 0;
    this.totalPausedMs = 0;
  }

  skip() {
    stopFfmpegProcess(this.ffmpegProcess);
    this.ffmpegProcess = null;
    this.audioPlayer.stop();
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex -= 2;
      stopFfmpegProcess(this.ffmpegProcess);
      this.ffmpegProcess = null;
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

  setSleepTimer(minutes) {
    this.cancelSleepTimer();
    const duration = Number(minutes);
    if (!Number.isFinite(duration) || duration <= 0) return false;
    this.sleepTimerEndsAt = Date.now() + duration * 60 * 1000;
    this.sleepTimer = setTimeout(() => {
      this.sleepTimer = null;
      this.sleepTimerEndsAt = 0;
      this.stop();
    }, duration * 60 * 1000);
    this._emitStatus();
    return true;
  }

  cancelSleepTimer() {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = null;
    this.sleepTimerEndsAt = 0;
    this._emitStatus();
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
      const current = this.currentIndex >= 0 ? this.queue[this.currentIndex] : null;
      this.queue = [...this.originalQueue];
      if (current) {
        const key = current.path || current.url;
        this.currentIndex = this.queue.findIndex((t) => (t.path || t.url) === key);
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
    const totalDuration = this.currentAbsDuration || this.currentDuration;
    return {
      guildId: this.guildId,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTrack: this.currentTrack,
      currentDuration: Math.round(this.currentDuration),
      currentTime: Math.round(currentTime),
      currentIndex: this.currentIndex,
      queueLength: this.queue.length,
      queue: this.queue.map((t) => {
        if (t.type === 'url') return t.title || t.url;
        return path.basename(t.path);
      }),
      volume: this.volume,
      loop: this.loop,
      shuffled: this.shuffled,
      connected: !!this.connection,
      source: this.currentSource,
      collection: this.currentCollection,
      audiobookshelfSessionId: this.currentAbsSessionId,
      audiobookshelfItemId: this.currentAbsItemId,
      audiobookshelfEpisodeId: this.currentAbsEpisodeId,
      audiobookshelfOffset: this.currentAbsOffset,
      audiobookshelfDuration: this.currentAbsDuration,
      navidromeSongId: this.currentNavidromeSongId,
      totalDuration: Math.round(totalDuration),
      currentProgressPercent: totalDuration > 0 ? Math.min(100, Math.round((currentTime / totalDuration) * 100)) : 0,
      audiobookshelfChapter: this.currentIndex >= 0 ? (this.queue[this.currentIndex]?.absChapterTitle || null) : null,
      sleepTimerSeconds: this.sleepTimerEndsAt ? Math.max(0, Math.ceil((this.sleepTimerEndsAt - Date.now()) / 1000)) : 0,
    };
  }

  _getAudiobookshelfPlayback() {
    if (!this.currentAbsSessionId) return null;
    return {
      guildId: this.guildId,
      sessionId: this.currentAbsSessionId,
      itemId: this.currentAbsItemId,
      episodeId: this.currentAbsEpisodeId,
      currentTime: this.currentAbsOffset + this.getCurrentTime(),
      duration: this.currentAbsDuration || this.currentDuration,
    };
  }

  _getPlaybackMetadata() {
    const abs = this._getAudiobookshelfPlayback();
    const navidromeSongId = this.currentNavidromeSongId;
    if (!abs && !navidromeSongId) return null;
    return {
      ...(abs || {}),
      guildId: this.guildId,
      navidromeSongId,
      currentTime: this.currentAbsOffset + this.getCurrentTime(),
      duration: this.currentAbsDuration || this.currentDuration,
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
      const key = current.path || current.url;
      this.currentIndex = this.queue.findIndex((t) => (t.path || t.url) === key);
    }
  }
}

export class PlayerManager {
  constructor(onStatusChange, onPlaybackEvent) {
    this.players = new Map();
    this.onStatusChange = onStatusChange;
    this.onPlaybackEvent = onPlaybackEvent;
  }
  get(guildId) {
    if (!this.players.has(guildId)) {
      this.players.set(guildId, new GuildPlayer(guildId, this.onStatusChange, this.onPlaybackEvent));
    }
    return this.players.get(guildId);
  }
  remove(guildId) {
    const player = this.players.get(guildId);
    if (player) { player.disconnect(); this.players.delete(guildId); }
    if (this.onStatusChange) this.onStatusChange(null);
  }
  has(guildId) { return this.players.has(guildId); }
}
