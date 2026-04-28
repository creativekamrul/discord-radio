import { useState, useEffect } from 'react';
import { api } from '../api';
import FileBrowser from './FileBrowser';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function LibraryPanel({ guildId, files, onFilesChanged, onQueueUpdate }) {
  const [tab, setTab] = useState('files');
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'playlists') return;
    setLoading(true);
    api.navidromePlaylists()
      .then(setPlaylists)
      .catch(() => setPlaylists([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const openPlaylist = async (id) => {
    setLoading(true);
    try {
      const detail = await api.navidromePlaylist(id);
      setPlaylistDetail(detail);
      setSelectedPlaylist(id);
    } catch {
      setPlaylistDetail(null);
    }
    setLoading(false);
  };

  const playPlaylist = async (id) => {
    await api.navidromePlayPlaylist(guildId, id);
    onQueueUpdate();
  };

  const queuePlaylist = async (id) => {
    await api.navidromeQueuePlaylist(guildId, id);
    onQueueUpdate();
  };

  const playSong = async (songId) => {
    await api.navidromePlaySong(guildId, songId);
    onQueueUpdate();
  };

  const enqueueSong = async (songId) => {
    await api.navidromeEnqueueSong(guildId, songId);
    onQueueUpdate();
  };

  return (
    <div className="card">
      <div className="section-tabs">
        <button className={`section-tab ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>Files</button>
        <button className={`section-tab ${tab === 'playlists' ? 'active' : ''}`} onClick={() => { setTab('playlists'); setSelectedPlaylist(null); setPlaylistDetail(null); }}>Navidrome Playlists</button>
      </div>

      {tab === 'files' ? (
        <FileBrowser guildId={guildId} files={files} onFilesChanged={onFilesChanged} onQueueUpdate={onQueueUpdate} />
      ) : (
        <>
          {loading && <p className="empty-state">Loading...</p>}

          {!loading && !selectedPlaylist && (
            <div className="list">
              {playlists.length === 0 ? (
                <p className="empty-state">No playlists on Navidrome</p>
              ) : (
                playlists.map((pl) => (
                  <div key={pl.id} className="list-item navidrome-item" onClick={() => openPlaylist(pl.id)}>
                    {pl.coverArt ? (
                      <img className="navidrome-thumb" src={api.navidromeCoverUrl(pl.coverArt)} alt="" />
                    ) : (
                      <span className="navidrome-icon">📁</span>
                    )}
                    <span className="name">{pl.name}</span>
                    <span className="navidrome-meta">{pl.songCount} tracks</span>
                    <div className="actions">
                      <button className="xs secondary" onClick={(e) => { e.stopPropagation(); queuePlaylist(pl.id); }}>+Q</button>
                      <button className="xs" onClick={(e) => { e.stopPropagation(); playPlaylist(pl.id); }}>▶</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && playlistDetail && (
            <>
              <div className="navidrome-detail-header">
                {playlistDetail.coverArt ? (
                  <img className="navidrome-cover" src={api.navidromeCoverUrl(playlistDetail.coverArt)} alt="" />
                ) : (
                  <span className="navidrome-icon large">📁</span>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{playlistDetail.name}</h3>
                  <span className="navidrome-meta">{playlistDetail.songCount} tracks &middot; {fmt(playlistDetail.duration)}</span>
                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem' }}>
                    <button className="xs" onClick={() => playPlaylist(playlistDetail.id)}>Play All</button>
                    <button className="xs secondary" onClick={() => queuePlaylist(playlistDetail.id)}>Add to Queue</button>
                    <button className="xs secondary" onClick={() => { setSelectedPlaylist(null); setPlaylistDetail(null); }}>Back</button>
                  </div>
                </div>
              </div>
              <div className="list">
                {playlistDetail.songs.map((s, i) => (
                  <div key={s.id} className="list-item navidrome-song-item">
                    <span className="idx">{i + 1}</span>
                    <span className="name">
                      <span className="song-title">{s.title}</span>
                      {s.artist && <span className="song-artist">{s.artist} · {s.album}</span>}
                    </span>
                    <span className="navidrome-meta">{fmt(s.duration)}</span>
                    <div className="actions">
                      <button className="xs secondary" onClick={() => enqueueSong(s.id)}>+Q</button>
                      <button className="xs" onClick={() => playSong(s.id)}>▶</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
