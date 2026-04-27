import { useState, useEffect } from 'react';
import { api } from '../api';

export default function ChannelSelector({ guildId, connectedChannel, onConnectedChange }) {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    api.getChannels(guildId).then(setChannels).catch(() => setChannels([]));
  }, [guildId]);

  const handleJoin = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await api.joinChannel(guildId, selected);
      onConnectedChange();
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLoading(true);
    try {
      await api.leaveChannel(guildId);
      onConnectedChange();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Voice Channel</h2>
      <div className="channel-selector">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a channel...</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name} ({ch.members} members)
            </option>
          ))}
        </select>
        {connectedChannel ? (
          <>
            <span className={`connection-badge connected`}>
              ● {connectedChannel.name}
            </span>
            <button className="danger sm" onClick={handleLeave} disabled={loading}>
              Leave
            </button>
          </>
        ) : (
          <>
            <span className="connection-badge disconnected">● Disconnected</span>
            <button onClick={handleJoin} disabled={!selected || loading}>
              Join
            </button>
          </>
        )}
      </div>
    </div>
  );
}
