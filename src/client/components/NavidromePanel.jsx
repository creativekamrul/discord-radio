import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function NavidromeArtwork({ coverArt, fallback, large = false }) {
  const elementRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '120px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [coverArt]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    setFailed(false);
    if (!coverArt || !visible) return () => { active = false; };

    api.navidromeCoverBlob(coverArt).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => {
      if (active) setFailed(true);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [coverArt, visible]);

  if (!src || failed) return <span ref={elementRef} className={`navidrome-icon${large ? ' large' : ''}`}>{fallback}</span>;
  return <img ref={elementRef} className={large ? 'navidrome-cover' : 'navidrome-thumb'} src={src} alt="" onError={() => setFailed(true)} />;
}

export default function NavidromePanel({ guildId, onQueueUpdate }) {
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState('albums');
  const [searchTab, setSearchTab] = useState('artists');
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [recentAlbums, setRecentAlbums] = useState([]);
  const [mostPlayedAlbums, setMostPlayedAlbums] = useState([]);
  const [artist, setArtist] = useState(null);
  const [album, setAlbum] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlist, setPlaylist] = useState(null);

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

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    try {
      setAlbums(await api.navidromeAlbums());
      setView('albums');
      setBreadcrumb([]);
    } catch { setAlbums([]); }
    setLoading(false);
  }, []);

  const loadRecentlyPlayed = useCallback(async () => {
    setLoading(true);
    try {
      setRecentAlbums(await api.navidromeAlbums('recent'));
      setView('recent');
      setBreadcrumb([]);
    } catch { setRecentAlbums([]); }
    setLoading(false);
  }, []);

  const loadMostPlayed = useCallback(async () => {
    setLoading(true);
    try {
      setMostPlayedAlbums(await api.navidromeAlbums('frequent'));
      setView('most-played');
      setBreadcrumb([]);
    } catch { setMostPlayedAlbums([]); }
    setLoading(false);
  }, []);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      setPlaylists(await api.navidromePlaylists());
      setPlaylist(null);
      setView('playlists');
      setBreadcrumb([]);
    } catch {}
    setLoading(false);
  }, []);

  const openPlaylist = async (id) => {
    setLoading(true);
    try {
      setPlaylist(await api.navidromePlaylist(id));
      setView('playlist');
      setBreadcrumb([{ label: 'Playlists', action: loadPlaylists }]);
    } catch { setPlaylist(null); }
    setLoading(false);
  };

  const playPlaylist = (id) => api.navidromePlayPlaylist(guildId, id).then(onQueueUpdate);
  const queuePlaylist = (id) => api.navidromeQueuePlaylist(guildId, id).then(onQueueUpdate);

  useEffect(() => {
    if (available) loadAlbums();
  }, [available, loadAlbums]);

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

  const openAlbum = useCallback(async (id, name, artistName, origin = 'artists') => {
    setLoading(true);
    try {
      const data = await api.navidromeAlbum(id);
      setAlbum(data);
      setView('album');
      const root = origin === 'albums'
        ? { label: 'Albums', action: loadAlbums }
        : origin === 'recent'
          ? { label: 'Recently Played', action: loadRecentlyPlayed }
          : origin === 'most-played'
            ? { label: 'Most Played', action: loadMostPlayed }
          : { label: 'Artists', action: loadArtists };
      const crumbs = [root];
      if (origin === 'artists') crumbs.push({ label: artistName, action: () => openArtist(artist?.id, artistName) });
      crumbs.push({ label: name });
      setBreadcrumb(crumbs);
    } catch {}
    setLoading(false);
  }, [loadAlbums, loadRecentlyPlayed, loadMostPlayed, loadArtists, openArtist, artist]);

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

  const playSong = async (songId, collection) => {
    await api.navidromePlaySong(guildId, songId, collection);
    onQueueUpdate();
  };

  const enqueueSong = async (songId, collection) => {
    await api.navidromeEnqueueSong(guildId, songId, collection);
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

      {!loading && view !== 'search' && (
        <div className="section-tabs">
          <button className={`section-tab ${view === 'albums' || view === 'album' ? 'active' : ''}`} onClick={loadAlbums}>Albums</button>
          <button className={`section-tab ${view === 'playlists' || view === 'playlist' ? 'active' : ''}`} onClick={loadPlaylists}>Playlists</button>
          <button className={`section-tab ${view === 'recent' ? 'active' : ''}`} onClick={loadRecentlyPlayed}>Recently Played</button>
          <button className={`section-tab ${view === 'most-played' ? 'active' : ''}`} onClick={loadMostPlayed}>Most Played</button>
          <button className={`section-tab ${view === 'artists' || view === 'artist' ? 'active' : ''}`} onClick={loadArtists}>Artists</button>
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
                <NavidromeArtwork coverArt={a.coverArt} fallback="🎤" />
                <span className="name">{a.name}</span>
                <span className="navidrome-meta">{a.albumCount} albums</span>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && (view === 'albums' || view === 'recent' || view === 'most-played') && (() => {
        const albumItems = view === 'recent' ? recentAlbums : view === 'most-played' ? mostPlayedAlbums : albums;
        const origin = view === 'recent' ? 'recent' : view === 'most-played' ? 'most-played' : 'albums';
        return <div className="list navidrome-list">
          {albumItems.length === 0 ? <p className="empty-state">{view === 'recent' ? 'No recently played albums' : view === 'most-played' ? 'No frequently played albums' : 'No albums found'}</p> : albumItems.map((item) => (
            <div key={item.id} className="list-item navidrome-item" onClick={() => openAlbum(item.id, item.name, item.artist, origin)}>
              <NavidromeArtwork coverArt={item.coverArt} fallback="💿" />
              <span className="name"><span className="song-title">{item.name}</span><span className="song-artist">{item.artist}</span></span>
              <span className="navidrome-meta">{item.year || ''}{item.year && item.songCount ? ' · ' : ''}{item.songCount ? `${item.songCount} tracks` : ''}</span>
              <div className="actions">
                <button className="xs secondary" onClick={(event) => { event.stopPropagation(); queueAlbum(item.id); }}>+Q</button>
                <button className="xs" onClick={(event) => { event.stopPropagation(); playAlbum(item.id); }}>▶</button>
              </div>
            </div>
          ))}
        </div>;
      })()}

      {!loading && view === 'playlists' && (
        <div className="list navidrome-list">
          {playlists.length === 0 ? <p className="empty-state">No playlists found</p> : playlists.map((pl) => (
            <div key={pl.id} className="list-item navidrome-item navidrome-playlist-item" onClick={() => openPlaylist(pl.id)}>
              <NavidromeArtwork coverArt={pl.coverArt} fallback="📋" />
              <span className="name"><span className="song-title">{pl.name}</span><span className="song-artist">{pl.songCount || 0} tracks</span></span>
              <div className="actions">
                <button className="xs secondary" onClick={(e) => { e.stopPropagation(); queuePlaylist(pl.id); }}>+Q</button>
                <button className="xs" onClick={(e) => { e.stopPropagation(); playPlaylist(pl.id); }}>▶</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && view === 'playlist' && playlist && (
        <>
          <div className="navidrome-detail-header">
            <NavidromeArtwork coverArt={playlist.coverArt} fallback="📋" large />
            <div><h3 style={{ margin: 0 }}>{playlist.name}</h3><span className="navidrome-meta">{playlist.songs.length} tracks</span></div>
            <div className="actions always-visible"><button className="xs secondary" onClick={() => queuePlaylist(playlist.id)}>Add to Queue</button><button className="xs" onClick={() => playPlaylist(playlist.id)}>Play All</button></div>
          </div>
          <div className="list navidrome-list">
            {playlist.songs.map((s, i) => (
              <div key={s.id} className="list-item navidrome-song-item">
                <span className="idx">{i + 1}</span>
                <span className="name"><span className="song-title">{s.title}</span><span className="song-artist">{s.artist} · {s.album}</span></span>
                <div className="actions"><button className="xs secondary" onClick={() => enqueueSong(s.id, playlist.name)}>+Q</button><button className="xs" onClick={() => playSong(s.id, playlist.name)}>▶</button></div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && view === 'artist' && artist && (
        <>
          <div className="navidrome-detail-header">
            <NavidromeArtwork coverArt={artist.coverArt} fallback="🎤" large />
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
                  <NavidromeArtwork coverArt={a.coverArt} fallback="💿" />
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
            <NavidromeArtwork coverArt={album.coverArt} fallback="💿" large />
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
                    <NavidromeArtwork coverArt={a.coverArt} fallback="🎤" />
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
                    <NavidromeArtwork coverArt={a.coverArt} fallback="💿" />
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
