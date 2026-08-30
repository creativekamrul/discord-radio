import { useEffect, useState } from 'react';
import { api } from '../api';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerSection({ guildId, status, onUpdate }) {
  const [finishState, setFinishState] = useState('idle');
  const [finishError, setFinishError] = useState('');
  const [navidromeTrack, setNavidromeTrack] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const songId = status?.navidromeSongId;
    setNavidromeTrack(null);
    if (!songId) return () => { active = false; };

    api.navidromeSong(songId).then(async (song) => {
      let coverUrl = '';
      if (song.coverArt) {
        try {
          const blob = await api.navidromeCoverBlob(song.coverArt);
          coverUrl = URL.createObjectURL(blob);
          objectUrl = coverUrl;
        } catch {}
      }
      if (active) setNavidromeTrack({ ...song, coverUrl });
      else if (coverUrl) URL.revokeObjectURL(coverUrl);
    }).catch(() => {});

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [status?.navidromeSongId]);

  if (!status) return <div className="card player-section player-card"><h2>Player</h2><p className="empty-state">Not connected</p></div>;

  const duration = status.totalDuration || status.currentDuration;
  const progress = duration > 0 ? Math.min(100, (status.currentTime / duration) * 100) : 0;
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seekTo = pct * duration;
    api.seek(guildId, seekTo).then(onUpdate);
  };

  const toggle = status.isPlaying && !status.isPaused ? () => api.pause(guildId).then(onUpdate) : () => api.resume(guildId).then(onUpdate);
  const markFinished = async () => {
    if (!status.audiobookshelfItemId) return;
    setFinishState('saving');
    setFinishError('');
    try {
      await api.audiobookshelfProgress(status.audiobookshelfItemId, {
        episodeId: status.audiobookshelfEpisodeId || null,
        currentTime: status.audiobookshelfDuration || duration,
        duration: status.audiobookshelfDuration || duration,
        isFinished: true,
      });
      setFinishState('saved');
      onUpdate();
    } catch (error) {
      setFinishState('error');
      setFinishError(error.message || 'Could not update Audiobookshelf progress.');
    }
  };

  return (
    <div className={`card player-section player-card ${status.isPlaying ? (status.isPaused ? 'is-paused' : 'is-playing') : 'is-stopped'}`}>
      <div className="player-disc" aria-hidden="true">
        <div className="disc-grooves" />
        <div className="disc-label"><span>♪</span></div>
      </div>
      <div className="now-playing-row">
        {navidromeTrack?.coverUrl
          ? <img className="np-cover" src={navidromeTrack.coverUrl} alt="" />
          : <div className="np-icon">{status.isPlaying ? '🎵' : '⏸️'}</div>}
        <div className="np-info">
          <div className="np-title">{navidromeTrack?.title || status.currentTrack || 'Nothing playing'}</div>
          {navidromeTrack?.artist && <div className="np-artist">{navidromeTrack.artist}{navidromeTrack.album ? <span> · {navidromeTrack.album}</span> : null}</div>}
          <div className="np-subtitle">
            {status.isPaused ? 'Paused' : status.isPlaying ? `Track ${status.currentIndex + 1} of ${status.queueLength}` : 'Stopped'}
          </div>
            {(status.source || status.collection) && (
            <div className="np-context"><span className="source-pill">{status.source || 'Media'}</span>{status.collection ? ` ${status.collection}` : ''}</div>
          )}
        </div>
      </div>

      <div className="seeker">
        <span className="time">{fmt(status.currentTime)}</span>
        <div className="seeker-track" onClick={handleSeek}>
          <div className="seeker-fill" style={{ width: `${progress}%` }} />
        </div>
         <span className="time right">{fmt(duration)}{duration > 0 && <small className="progress-percent">{status.currentProgressPercent}%</small>}</span>
      </div>

      <div className="controls-row">
        <button className={`icon-btn utility-btn ${status.shuffled ? 'active-control' : ''}`} onClick={() => api.toggleShuffle(guildId).then(onUpdate)} title="Shuffle" aria-label="Shuffle">
          🔀
        </button>
        <button className="icon-btn transport-btn" onClick={() => api.previous(guildId).then(onUpdate)} title="Previous" aria-label="Previous track">⏮</button>
        <button className="play-btn" onClick={toggle} title={status.isPlaying && !status.isPaused ? 'Pause' : 'Play'} aria-label={status.isPlaying && !status.isPaused ? 'Pause' : 'Play'}>
          {status.isPlaying && !status.isPaused ? '⏸' : '▶'}
        </button>
        <button className="icon-btn transport-btn" onClick={() => api.skip(guildId).then(onUpdate)} title="Next" aria-label="Next track">⏭</button>
        <button className="icon-btn utility-btn stop-btn" onClick={() => api.stop(guildId).then(onUpdate)} title="Stop" aria-label="Stop">⏹</button>
      </div>

      <div className="toggles-row" aria-label="Playback modes">
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
      {status.audiobookshelfItemId && <div className="player-finish-row">
        <button className="finish-player-btn" disabled={finishState === 'saving' || finishState === 'saved'} onClick={markFinished}>
          {finishState === 'saving' ? 'Saving…' : finishState === 'saved' ? '✓ Finished' : `✓ Mark ${status.audiobookshelfEpisodeId ? 'episode' : 'book'} finished`}
        </button>
        {finishError && <span className="progress-action-error" role="alert">{finishError}</span>}
      </div>}
    </div>
  );
}
