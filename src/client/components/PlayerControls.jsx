import { useState, useCallback } from 'react';
import { api } from '../api';

export default function PlayerControls({ guildId, status, onUpdate }) {
  const [volume, setVolume] = useState(status?.volume ?? 0.5);

  const handlePlay = () => api.play(guildId).then(onUpdate);
  const handlePause = () => api.pause(guildId).then(onUpdate);
  const handleResume = () => api.resume(guildId).then(onUpdate);
  const handleStop = () => api.stop(guildId).then(onUpdate);
  const handleSkip = () => api.skip(guildId).then(onUpdate);

  const handleVolumeChange = useCallback((e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    api.setVolume(guildId, v);
  }, [guildId]);

  const handleLoop = (mode) => api.setLoop(guildId, mode).then(onUpdate);
  const handleShuffle = () => api.toggleShuffle(guildId).then(onUpdate);

  if (!status) return null;

  return (
    <div className="card">
      <h2>Controls</h2>
      <div className="player-controls">
        <div className="control-buttons">
          <button className="secondary" onClick={handleStop} title="Stop">⏹</button>
          <button className="secondary" onClick={handleSkip} title="Skip">⏭</button>
          {status.isPlaying && !status.isPaused ? (
            <button className="play-btn" onClick={handlePause} title="Pause">⏸</button>
          ) : (
            <button className="play-btn" onClick={status.isPaused ? handleResume : handlePlay} title="Play">▶</button>
          )}
        </div>

        <div className="volume-control">
          <label>🔊</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
          />
          <span className="volume-value">{Math.round(volume * 100)}%</span>
        </div>

        <div className="extra-controls">
          <button
            className={`sm secondary ${status.loop === 'none' ? 'active' : ''}`}
            onClick={() => handleLoop('none')}
          >
            No Loop
          </button>
          <button
            className={`sm secondary ${status.loop === 'track' ? 'active' : ''}`}
            onClick={() => handleLoop('track')}
          >
            Loop 1
          </button>
          <button
            className={`sm secondary ${status.loop === 'queue' ? 'active' : ''}`}
            onClick={() => handleLoop('queue')}
          >
            Loop All
          </button>
          <button
            className={`sm secondary ${status.shuffled ? 'active' : ''}`}
            onClick={handleShuffle}
          >
            🔀 Shuffle
          </button>
        </div>
      </div>
    </div>
  );
}
