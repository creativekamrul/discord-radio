export default function NowPlaying({ status }) {
  if (!status) {
    return (
      <div className="card now-playing">
        <h2>Now Playing</h2>
        <span className="track-icon">🎵</span>
        <p className="no-track">Not connected</p>
      </div>
    );
  }

  const statusText = status.isPaused
    ? 'Paused'
    : status.isPlaying
    ? 'Playing'
    : 'Stopped';

  return (
    <div className="card now-playing">
      <h2>Now Playing</h2>
      <span className="track-icon">{status.isPlaying ? '🎵' : '⏹️'}</span>
      {status.currentTrack ? (
        <>
          <p className="track-name">{status.currentTrack}</p>
          <p className="track-status">{statusText}</p>
        </>
      ) : (
        <p className="no-track">No track playing</p>
      )}
    </div>
  );
}
