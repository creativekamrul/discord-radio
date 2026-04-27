import { api } from '../api';

export default function QueuePanel({ guildId, status, onUpdate }) {
  if (!status) return null;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Queue ({status.queueLength})</h2>
        {status.queueLength > 0 && <button className="xs danger" onClick={() => api.clearQueue(guildId).then(onUpdate)}>Clear</button>}
      </div>
      {status.queueLength === 0 ? (
        <p className="empty-state">Queue is empty</p>
      ) : (
        <div className="list">
          {status.queue.map((track, i) => (
            <div key={`${track}-${i}`} className={`list-item ${i === status.currentIndex ? 'active playing' : ''}`}>
              <span className="idx">{i === status.currentIndex ? '♫' : i + 1}</span>
              <span className="name">{track}</span>
              <div className="actions">
                {i !== status.currentIndex && <button className="xs" onClick={() => api.playQueueIndex(guildId, i).then(onUpdate)}>▶</button>}
                <button className="xs danger" onClick={() => api.removeFromQueue(guildId, i).then(onUpdate)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
