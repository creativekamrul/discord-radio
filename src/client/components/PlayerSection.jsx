import { api } from '../api';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerSection({ guildId, status, onUpdate }) {
  if (!status) return <div className="card player-section player-card"><h2>Player</h2><p className="empty-state">Not connected</p></div>;

  const progress = status.currentDuration > 0 ? (status.currentTime / status.currentDuration) * 100 : 0;
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seekTo = pct * status.currentDuration;
    api.seek(guildId, seekTo).then(onUpdate);
  };

  const toggle = status.isPlaying && !status.isPaused ? () => api.pause(guildId).then(onUpdate) : () => api.resume(guildId).then(onUpdate);

  return (
    <div className="card player-section player-card">
      <div className="now-playing-row">
        <div className="np-icon">{status.isPlaying ? '🎵' : '⏸️'}</div>
        <div className="np-info">
          <div className="np-title">{status.currentTrack || 'Nothing playing'}</div>
          <div className="np-subtitle">
            {status.isPaused ? 'Paused' : status.isPlaying ? `Track ${status.currentIndex + 1} of ${status.queueLength}` : 'Stopped'}
          </div>
        </div>
      </div>

      <div className="seeker">
        <span className="time">{fmt(status.currentTime)}</span>
        <div className="seeker-track" onClick={handleSeek}>
          <div className="seeker-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="time right">{fmt(status.currentDuration)}</span>
      </div>

      <div className="controls-row">
        <button className="icon-btn" onClick={() => api.setLoop(guildId, status.loop === 'none' ? 'none' : 'none')} title="Shuffle">
          🔀
        </button>
        <button className="icon-btn" onClick={() => api.previous(guildId).then(onUpdate)} title="Previous">⏮</button>
        <button className="play-btn" onClick={toggle}>
          {status.isPlaying && !status.isPaused ? '⏸' : '▶'}
        </button>
        <button className="icon-btn" onClick={() => api.skip(guildId).then(onUpdate)} title="Next">⏭</button>
        <button className="icon-btn" onClick={() => api.stop(guildId).then(onUpdate)} title="Stop">⏹</button>
      </div>

      <div className="toggles-row">
        <button className={`sm secondary ${status.loop === 'none' ? 'active-toggle' : ''}`} onClick={() => api.setLoop(guildId, 'none').then(onUpdate)}>No Loop</button>
        <button className={`sm secondary ${status.loop === 'track' ? 'active-toggle' : ''}`} onClick={() => api.setLoop(guildId, 'track').then(onUpdate)}>Loop 1</button>
        <button className={`sm secondary ${status.loop === 'queue' ? 'active-toggle' : ''}`} onClick={() => api.setLoop(guildId, 'queue').then(onUpdate)}>Loop All</button>
        <button className={`sm secondary ${status.shuffled ? 'active-toggle' : ''}`} onClick={() => api.toggleShuffle(guildId).then(onUpdate)}>🔀 Shuffle</button>
      </div>

      <div className="volume-row">
        <span className="volume-label">🔊</span>
        <input type="range" min="0" max="1" step="0.01" value={status.volume}
          onChange={(e) => { api.setVolume(guildId, parseFloat(e.target.value)); onUpdate(); }}
          style={{ width: '120px' }} />
        <span className="volume-val">{Math.round(status.volume * 100)}%</span>
      </div>
    </div>
  );
}
