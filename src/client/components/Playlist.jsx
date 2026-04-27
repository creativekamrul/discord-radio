import { api } from '../api';

export default function Playlist({ guildId, status, onUpdate }) {
  if (!status) return null;

  const handleRemove = (index) => {
    api.removeFromQueue(guildId, index).then(onUpdate);
  };

  const handleClear = () => {
    api.clearQueue(guildId).then(onUpdate);
  };

  const handlePlayIndex = (index) => {
    const player = status;
    if (index === player.currentIndex) return;
    api.skip(guildId).then(onUpdate);
  };

  return (
    <div className="card playlist">
      <div className="queue-header">
        <h2>Queue</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="queue-count">{status.queueLength} tracks</span>
          {status.queueLength > 0 && (
            <button className="sm danger" onClick={handleClear}>Clear</button>
          )}
        </div>
      </div>
      {status.queueLength === 0 ? (
        <p className="empty-state">Queue is empty. Add files from the browser.</p>
      ) : (
        <div className="queue-list">
          {status.queue.map((track, i) => (
            <div
              key={`${track}-${i}`}
              className={`queue-item ${i === status.currentIndex ? 'active' : ''}`}
            >
              <span className="queue-index">
                {i === status.currentIndex ? '♫' : `${i + 1}.`}
              </span>
              <span className="queue-name">{track}</span>
              <button
                className="sm secondary queue-remove"
                onClick={() => handleRemove(i)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
