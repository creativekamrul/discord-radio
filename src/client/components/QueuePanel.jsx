import { api } from '../api';

export default function QueuePanel({ guildId, status, onUpdate }) {
  const queue = status?.queue || [];
  const queueLength = status?.queueLength ?? queue.length;
  const currentIndex = status?.currentIndex ?? -1;

  return (
    <div className="card queue-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Queue ({queueLength})</h2>
        {queueLength > 0 && <button className="xs danger" onClick={() => api.clearQueue(guildId).then(onUpdate)}>Clear</button>}
      </div>
      {queueLength === 0 ? (
        <p className="empty-state">Queue is empty</p>
      ) : (
        <div className="list">
          {queue.map((track, i) => (
            <div key={`${track}-${i}`} className={`list-item ${i === currentIndex ? 'active playing' : ''}`}>
              <span className="idx">{i === currentIndex ? '♫' : i + 1}</span>
              <span className="name">{track}</span>
              <div className="actions">
                {i !== currentIndex && <button className="xs" onClick={() => api.playQueueIndex(guildId, i).then(onUpdate)}>▶</button>}
                <button className="xs danger" onClick={() => api.removeFromQueue(guildId, i).then(onUpdate)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
