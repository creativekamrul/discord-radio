import { useState, useEffect } from 'react';
import { api } from '../api';

export default function PlaylistManager({ guildId, files, onQueueUpdate }) {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setPlaylists(await api.getPlaylists()); } catch {}
  };

  const create = async () => {
    if (!newName.trim()) return;
    const pl = await api.createPlaylist(newName.trim());
    setNewName('');
    setPlaylists([...playlists, pl]);
    setSelected(pl.id);
  };

  const remove = async (id) => {
    await api.deletePlaylist(id);
    if (selected === id) setSelected(null);
    load();
  };

  const addTrack = async (file) => {
    if (!selected) return;
    await api.addPlaylistTracks(selected, [file]);
    load();
  };

  const removeTrack = async (file) => {
    if (!selected) return;
    await api.removePlaylistTracks(selected, [file]);
    load();
  };

  const playAll = async (id) => {
    await api.playPlaylist(guildId, id);
    onQueueUpdate();
  };

  const enqueue = async (id) => {
    await api.enqueuePlaylist(guildId, id);
    onQueueUpdate();
  };

  const active = playlists.find((p) => p.id === selected);

  return (
    <>
      <div className="playlist-form">
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New playlist name..." onKeyDown={(e) => e.key === 'Enter' && create()} />
        <button className="sm" onClick={create}>Create</button>
      </div>

      {playlists.length === 0 ? (
        <p className="empty-state">No playlists yet. Create one above.</p>
      ) : (
        <div className="list" style={{ maxHeight: '150px', marginBottom: '0.75rem' }}>
          {playlists.map((pl) => (
            <div key={pl.id} className={`playlist-item ${selected === pl.id ? 'selected' : ''}`} onClick={() => setSelected(pl.id)}>
              <span className="pl-name">📁 {pl.name}</span>
              <span className="pl-count">{pl.tracks.length}</span>
              <div className="pl-actions">
                <button className="xs" onClick={(e) => { e.stopPropagation(); playAll(pl.id); }}>▶</button>
                <button className="xs secondary" onClick={(e) => { e.stopPropagation(); enqueue(pl.id); }}>+Q</button>
                <button className="xs danger" onClick={(e) => { e.stopPropagation(); remove(pl.id); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <h2 style={{ margin: 0 }}>{active.name} — {active.tracks.length} tracks</h2>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button className="xs" onClick={() => playAll(active.id)}>Play All</button>
              <button className="xs secondary" onClick={() => enqueue(active.id)}>Add to Queue</button>
            </div>
          </div>

          {active.tracks.length > 0 ? (
            <div className="list" style={{ maxHeight: '180px' }}>
              {active.tracks.map((t) => (
                <div key={t} className="list-item">
                  <span className="name">🎵 {t}</span>
                  <div className="actions">
                    <button className="xs danger" onClick={() => removeTrack(t)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state" style={{ padding: '0.75rem' }}>No tracks. Add files from below.</p>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Add tracks:</div>
            <div className="list" style={{ maxHeight: '120px' }}>
              {files.filter((f) => !active.tracks.includes(f)).map((f) => (
                <div key={f} className="list-item" style={{ cursor: 'pointer' }} onClick={() => addTrack(f)}>
                  <span className="name" style={{ fontSize: '0.82rem' }}>+ {f}</span>
                </div>
              ))}
              {files.filter((f) => !active.tracks.includes(f)).length === 0 && (
                <p className="empty-state" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>All files already added</p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
