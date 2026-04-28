import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function NavidromePanel({ guildId, onQueueUpdate }) {
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState('artists');
  const [searchTab, setSearchTab] = useState('artists');
  const [artists, setArtists] = useState([]);
  const [artist, setArtist] = useState(null);
  const [album, setAlbum] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState([]);

  useEffect(() => {
    api.navidromeStatus().then((r) => {
      setAvailable(r.available);
      setChecked(true);
    }).catch(() => { setAvailable(false); setChecked(true); });
  }, []);

  const loadArtists = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.navidromeArtists();
      setArtists(data);
      setView('artists');
      setBreadcrumb([]);
    } catch {}
    setLoading(false);
  }, []);

  const openArtist = useCallback(async (id, name) => {
    setLoading(true);
    try {
      const data = await api.navidromeArtist(id);
      setArtist(data);
      setView('artist');
      setBreadcrumb([{ label: 'Artists', action: loadArtists }, { label: name }]);
    } catch {}
    setLoading(false);
  }, [loadArtists]);

  const openAlbum = useCallback(async (id, name, artistName) => {
    setLoading(true);
    try {
      const data = await api.navidromeAlbum(id);
      setAlbum(data);
      setView('album');
      setBreadcrumb([
        { label: 'Artists', action: loadArtists },
        { label: artistName, action: () => openArtist(artist?.id, artistName) },
        { label: name },
      ]);
    } catch {}
    setLoading(false);
  }, [loadArtists, openArtist, artist]);

  const doSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const data = await api.navidromeSearch(searchQuery.trim());
      setSearchResults(data);
      setView('search');
      setSearchTab('artists');
      setBreadcrumb([{ label: 'Artists', action: loadArtists }, { label: `Search: ${searchQuery}` }]);
    } catch {}
    setLoading(false);
  }, [searchQuery, loadArtists]);

  const playSong = async (songId) => {
    await api.navidromePlaySong(guildId, songId);
    onQueueUpdate();
  };

  const enqueueSong = async (songId) => {
    await api.navidromeEnqueueSong(guildId, songId);
    onQueueUpdate();
  };

  const playAlbum = async (albumId) => {
    await api.navidromePlayAlbum(guildId, albumId);
    onQueueUpdate();
  };

  const queueAlbum = async (albumId) => {
    await api.navidromeQueueAlbum(guildId, albumId);
    onQueueUpdate();
  };

  if (!checked) return null;
  if (!available) return null;

  return (
    <div className="navidrome-panel">
      <div className="navidrome-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="Search artists, albums, songs..."
        />
        <button className="sm" onClick={doSearch} disabled={!searchQuery.trim()}>Search</button>
      </div>

      {breadcrumb.length > 0 && (
        <div className="navidrome-breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <span key={i}>
              {i > 0 && <span className="bc-sep">/</span>}
              {crumb.action ? (
                <button className="bc-link" onClick={crumb.action}>{crumb.label}</button>
              ) : (
                <span className="bc-current">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {loading && <p className="empty-state">Loading...</p>}

      {!loading && (view === 'artists' || view === 'artist' || view === 'album') && (
        <div className="section-tabs">
          <button className={`section-tab ${view === 'artists' ? 'active' : ''}`} onClick={loadArtists}>Artists</button>
        </div>
      )}

      {!loading && view === 'search' && searchResults && (
        <div className="section-tabs">
          <button className={`section-tab ${searchTab === 'artists' ? 'active' : ''}`} onClick={() => setSearchTab('artists')}>
            Artists {searchResults.artists.length > 0 && `(${searchResults.artists.length})`}
          </button>
          <button className={`section-tab ${searchTab === 'albums' ? 'active' : ''}`} onClick={() => setSearchTab('albums')}>
            Albums {searchResults.albums.length > 0 && `(${searchResults.albums.length})`}
          </button>
          <button className={`section-tab ${searchTab === 'songs' ? 'active' : ''}`} onClick={() => setSearchTab('songs')}>
            Songs {searchResults.songs.length > 0 && `(${searchResults.songs.length})`}
          </button>
        </div>
      )}

      {!loading && view === 'artists' && (
        <div className="list navidrome-list">
          {artists.length === 0 ? (
            <p className="empty-state">No artists found</p>
          ) : (
            artists.map((a) => (
              <div key={a.id} className="list-item navidrome-item" onClick={() => openArtist(a.id, a.name)}>
                {a.coverArt ? (
                  <img className="navidrome-thumb" src={api.navidromeCoverUrl(a.coverArt)} alt="" />
                ) : (
                  <span className="navidrome-icon">🎤</span>
                )}
                <span className="name">{a.name}</span>
                <span className="navidrome-meta">{a.albumCount} albums</span>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && view === 'artist' && artist && (
        <>
          <div className="navidrome-detail-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{artist.name}</h3>
              <span className="navidrome-meta">{artist.albumCount} albums</span>
            </div>
          </div>
          <div className="list navidrome-list">
            {artist.albums.length === 0 ? (
              <p className="empty-state">No albums</p>
            ) : (
              artist.albums.map((a) => (
                <div key={a.id} className="list-item navidrome-item" onClick={() => openAlbum(a.id, a.name, artist.name)}>
                  {a.coverArt ? (
                    <img className="navidrome-thumb" src={api.navidromeCoverUrl(a.coverArt)} alt="" />
                  ) : (
                    <span className="navidrome-icon">💿</span>
                  )}
                  <span className="name">{a.name}</span>
                  <span className="navidrome-meta">{a.year || ''} &middot; {a.songCount} tracks</span>
                  <div className="actions">
                    <button className="xs secondary" onClick={(e) => { e.stopPropagation(); queueAlbum(a.id); }}>+Q</button>
                    <button className="xs" onClick={(e) => { e.stopPropagation(); playAlbum(a.id); }}>▶</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!loading && view === 'album' && album && (
        <>
          <div className="navidrome-detail-header">
            {album.coverArt ? (
              <img className="navidrome-cover" src={api.navidromeCoverUrl(album.coverArt)} alt="" />
            ) : (
              <span className="navidrome-icon large">💿</span>
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{album.name}</h3>
              <span className="navidrome-meta">{album.artist} {album.year ? `· ${album.year}` : ''} · {album.songCount} tracks</span>
              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem' }}>
                <button className="xs" onClick={() => playAlbum(album.id)}>Play All</button>
                <button className="xs secondary" onClick={() => queueAlbum(album.id)}>Add to Queue</button>
              </div>
            </div>
          </div>
          <div className="list navidrome-list">
            {album.songs.map((s, i) => (
              <div key={s.id} className="list-item navidrome-song-item">
                <span className="idx">{s.track || i + 1}</span>
                <span className="name">
                  <span className="song-title">{s.title}</span>
                  {s.artist && <span className="song-artist">{s.artist}</span>}
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

      {!loading && view === 'search' && searchResults && (
        <>
          {searchTab === 'artists' && (
            <div className="list navidrome-list">
              {searchResults.artists.length === 0 ? (
                <p className="empty-state">No artists found</p>
              ) : (
                searchResults.artists.map((a) => (
                  <div key={a.id} className="list-item navidrome-item" onClick={() => openArtist(a.id, a.name)}>
                    {a.coverArt ? (
                      <img className="navidrome-thumb" src={api.navidromeCoverUrl(a.coverArt)} alt="" />
                    ) : (
                      <span className="navidrome-icon">🎤</span>
                    )}
                    <span className="name">{a.name}</span>
                    <span className="navidrome-meta">{a.albumCount} albums</span>
                  </div>
                ))
              )}
            </div>
          )}

          {searchTab === 'albums' && (
            <div className="list navidrome-list">
              {searchResults.albums.length === 0 ? (
                <p className="empty-state">No albums found</p>
              ) : (
                searchResults.albums.map((a) => (
                  <div key={a.id} className="list-item navidrome-item" onClick={() => openAlbum(a.id, a.name, a.artist)}>
                    {a.coverArt ? (
                      <img className="navidrome-thumb" src={api.navidromeCoverUrl(a.coverArt)} alt="" />
                    ) : (
                      <span className="navidrome-icon">💿</span>
                    )}
                    <span className="name">{a.name}</span>
                    <span className="navidrome-meta">{a.artist} {a.year ? `· ${a.year}` : ''}</span>
                    <div className="actions">
                      <button className="xs secondary" onClick={(e) => { e.stopPropagation(); queueAlbum(a.id); }}>+Q</button>
                      <button className="xs" onClick={(e) => { e.stopPropagation(); playAlbum(a.id); }}>▶</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {searchTab === 'songs' && (
            <div className="list navidrome-list">
              {searchResults.songs.length === 0 ? (
                <p className="empty-state">No songs found</p>
              ) : (
                searchResults.songs.map((s, i) => (
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
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
