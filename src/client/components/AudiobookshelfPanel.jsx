import { useEffect, useState } from 'react';
import { api } from '../api';

function fmt(seconds) {
  if (!seconds || isNaN(seconds)) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function AudiobookshelfPanel({ guildId, onQueueUpdate }) {
  const [available, setAvailable] = useState(false);
  const [libraries, setLibraries] = useState([]);
  const [libraryId, setLibraryId] = useState('');
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    api.audiobookshelfStatus().then((r) => setAvailable(r.available)).catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    if (!available) return;
    api.audiobookshelfLibraries().then((data) => {
      setLibraries(data);
      if (data[0]) setLibraryId(data[0].id);
    }).catch(() => setLibraries([]));
  }, [available]);

  useEffect(() => {
    if (!libraryId) return;
    setLoading(true);
    api.audiobookshelfItems(libraryId).then((data) => setItems(data.results || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, [libraryId]);

  const search = async () => {
    if (!libraryId || !query.trim()) return;
    setLoading(true);
    try {
      const data = await api.audiobookshelfSearch(libraryId, query.trim());
      setItems(data.book || data.podcast || []);
    } catch { setItems([]); }
    setLoading(false);
  };

  const openItem = async (id) => {
    setLoading(true);
    try { setSelectedItem(await api.audiobookshelfItem(id)); }
    catch { setSelectedItem(null); }
    setLoading(false);
  };

  const play = (itemId, episodeId) => api.audiobookshelfPlay(guildId, itemId, episodeId).then(onQueueUpdate);
  const enqueue = (itemId, episodeId) => api.audiobookshelfQueue(guildId, itemId, episodeId).then(onQueueUpdate);

  if (!available) return null;
  return (
    <div className="card audiobook-panel">
      <div className="section-tabs"><h2 style={{ margin: 0 }}>Audiobookshelf</h2></div>
      <div className="navidrome-search">
        <select value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
          {libraries.map((lib) => <option key={lib.id} value={lib.id}>{lib.name}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search books..." />
        <button className="sm" onClick={search} disabled={!query.trim()}>Search</button>
      </div>
      {loading && <p className="empty-state">Loading...</p>}
      {!loading && selectedItem && <>
        <div className="navidrome-detail-header">
          <div><h3 style={{ margin: 0 }}>{selectedItem.title}</h3><span className="navidrome-meta">{selectedItem.author}</span></div>
          <button className="xs secondary" onClick={() => setSelectedItem(null)}>Back</button>
        </div>
        {selectedItem.episodes?.length > 0 ? <div className="list navidrome-list">
          {selectedItem.episodes.map((episode, index) => (
            <div key={episode.id} className="list-item navidrome-song-item">
              <span className="idx">{episode.episode || index + 1}</span>
              <span className="name"><span className="song-title">{episode.title}</span><span className="song-artist">{fmt(episode.duration)}</span></span>
              <div className="actions"><button className="xs secondary" onClick={() => enqueue(selectedItem.id, episode.id)}>+Q</button><button className="xs" onClick={() => play(selectedItem.id, episode.id)}>▶</button></div>
            </div>
          ))}
        </div> : <p className="empty-state">No individual episodes. This item can be played as a book.</p>}
      </>}
      {!loading && !selectedItem && <div className="list navidrome-list">
        {items.length === 0 ? <p className="empty-state">No audiobooks found</p> : items.map((item) => (
          <div key={item.id} className="list-item navidrome-item audiobook-item" onClick={() => openItem(item.id)}>
            {item.coverArt ? <img className="navidrome-thumb" src={item.coverArt} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'flex'; }} /> : null}
            <span className="navidrome-icon audiobook-fallback" style={{ display: item.coverArt ? 'none' : 'flex' }}>📚</span>
            <span className="name"><span className="song-title">{item.title}</span><span className="song-artist">{item.author}{item.series ? ` · ${item.series}` : ''}</span></span>
            <span className="navidrome-meta">{item.progress > 0 ? `${Math.round((item.progress / item.duration) * 100)}%` : fmt(item.duration)}</span>
            <div className="actions">
              {item.mediaType !== 'podcast' && <>
                <button className="xs secondary" onClick={(e) => { e.stopPropagation(); enqueue(item.id); }}>+Q</button>
                <button className="xs" onClick={(e) => { e.stopPropagation(); play(item.id); }}>▶</button>
              </>}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
