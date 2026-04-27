import { useState, useEffect } from 'react';
import { api } from '../api';

export default function ChannelBar({ guildId, connectedChannel, onUpdate }) {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (!guildId) return;
    api.getChannels(guildId).then(setChannels).catch(() => setChannels([]));
  }, [guildId]);

  const handleJoin = () => {
    if (!selected) return;
    api.joinChannel(guildId, selected).then(onUpdate);
  };

  const handleLeave = () => {
    api.leaveChannel(guildId).then(onUpdate);
  };

  return (
    <div className="card">
      <div className="channel-bar">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select channel...</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.name} ({ch.members})</option>
          ))}
        </select>
        {connectedChannel ? (
          <>
            <span className="badge online">● {connectedChannel.name}</span>
            <button className="danger sm" onClick={handleLeave}>Leave</button>
          </>
        ) : (
          <>
            <span className="badge offline">● Disconnected</span>
            <button onClick={handleJoin} disabled={!selected}>Join</button>
          </>
        )}
      </div>
    </div>
  );
}
