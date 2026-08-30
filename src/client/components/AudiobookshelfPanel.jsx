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
  const [continueItems, setContinueItems] = useState([]);
  const [section, setSection] = useState('browse');
  const [episodeFilter, setEpisodeFilter] = useState('all');
  const [progressError, setProgressError] = useState('');
  const [finishingId, setFinishingId] = useState('');

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

  const loadContinue = () => api.audiobookshelfContinue().then(setContinueItems).catch(() => setContinueItems([]));
  useEffect(() => { if (available) loadContinue(); }, [available]);

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
    setEpisodeFilter('all');
    try { setSelectedItem(await api.audiobookshelfItem(id)); }
    catch { setSelectedItem(null); }
    setLoading(false);
  };

  const play = (itemId, episodeId) => api.audiobookshelfPlay(guildId, itemId, episodeId).then(() => { onQueueUpdate(); loadContinue(); });
  const enqueue = (itemId, episodeId) => api.audiobookshelfQueue(guildId, itemId, episodeId).then(onQueueUpdate);
  const markFinished = async (item, episodeId = null, duration = 0) => {
    const targetId = episodeId || item.id;
    setProgressError('');
    setFinishingId(targetId);
    try {
      await api.audiobookshelfProgress(item.id, { episodeId, isFinished: true, currentTime: duration || item.duration, duration: duration || item.duration });
      if (episodeId) setSelectedItem(await api.audiobookshelfItem(item.id));
      else setSelectedItem(null);
      loadContinue();
    } catch (error) {
      setProgressError(error.message || 'Could not update Audiobookshelf progress.');
    } finally {
      setFinishingId('');
    }
  };
  const playChapter = async (itemId, chapter) => { await api.audiobookshelfPlay(guildId, itemId); await api.seek(guildId, chapter.start); onQueueUpdate(); };

  const episodes = selectedItem?.episodes || [];
  const finishedEpisodeCount = episodes.filter((episode) => episode.finished).length;
  const filteredEpisodes = episodes.filter((episode) => {
    if (episodeFilter === 'finished') return episode.finished;
    if (episodeFilter === 'unfinished') return !episode.finished;
    return true;
  });

  if (!available) return null;
  return (
    <div className="card audiobook-panel">
      <div className="section-tabs"><h2 style={{ margin: 0 }}>Audiobookshelf</h2></div>
      <div className="audiobookshelf-search">
        <select value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
          {libraries.map((lib) => <option key={lib.id} value={lib.id}>{lib.name}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search books..." />
        <button className="sm" onClick={search} disabled={!query.trim()}>Search</button>
      </div>
      <div className="abs-view-tabs" role="tablist" aria-label="Audiobookshelf views">
        <button className={section === 'browse' ? 'active' : ''} onClick={() => setSection('browse')} role="tab" aria-selected={section === 'browse'}>Browse library</button>
        <button className={section === 'continue' ? 'active' : ''} onClick={() => setSection('continue')} role="tab" aria-selected={section === 'continue'}>Continue Listening {continueItems.length > 0 && <span>{continueItems.length}</span>}</button>
      </div>
      {section === 'continue' && !selectedItem && <div className="continue-listening">
        <div className="subsection-heading"><span>Continue Listening</span><small>{continueItems.length} in progress</small></div>
        <div className="list continue-list">
          {continueItems.map((item, index) => {
            const percent = Math.round((item.progressPercent || (item.duration ? item.progress / item.duration : 0)) * 100);
            return <div key={`${item.id}-${item.recentEpisode?.id || index}`} className="list-item audiobook-item continue-item">
            <span className="navidrome-icon audiobook-fallback">▶</span>
            <span className="name"><span className="song-title">{item.episodeFileName || item.episodeTitle || item.recentEpisode?.id || (item.mediaType === 'podcast' ? 'Episode' : item.title)}</span><span className="song-artist">{item.parentTitle ? `${item.parentTitle} · ` : ''}{item.author}</span><span className="continue-progress"><span style={{ width: `${Math.min(100, percent)}%` }} /></span></span>
            <span className="navidrome-meta">{percent}%</span>
            <button className="xs" onClick={() => play(item.id, item.recentEpisode?.id)}>Resume</button>
          </div>;
          })}
        </div>
      </div>}
      {loading && <p className="empty-state">Loading...</p>}
      {section === 'browse' && !loading && selectedItem && <>
        <div className="navidrome-detail-header">
          <div><h3 style={{ margin: 0 }}>{selectedItem.title}</h3><span className="navidrome-meta">{selectedItem.author}</span></div>
          <div className="actions"><button className="xs secondary" onClick={() => setSelectedItem(null)}>Back</button>{!selectedItem.episodes?.length && <button className="xs" disabled={finishingId === selectedItem.id} onClick={() => markFinished(selectedItem)}>{finishingId === selectedItem.id ? 'Saving…' : 'Mark book finished'}</button>}</div>
        </div>
        {progressError && <p className="progress-action-error" role="alert">{progressError}</p>}
        {selectedItem.episodes?.length > 0 ? <>
          <div className="episode-filter" role="group" aria-label="Filter episodes by completion">
            <button className={episodeFilter === 'all' ? 'active' : ''} onClick={() => setEpisodeFilter('all')}>All <span>{episodes.length}</span></button>
            <button className={episodeFilter === 'unfinished' ? 'active' : ''} onClick={() => setEpisodeFilter('unfinished')}>Unfinished <span>{episodes.length - finishedEpisodeCount}</span></button>
            <button className={episodeFilter === 'finished' ? 'active' : ''} onClick={() => setEpisodeFilter('finished')}>Finished <span>{finishedEpisodeCount}</span></button>
          </div>
          <div className="list navidrome-list episode-list">
          {filteredEpisodes.map((episode) => {
            const episodeIndex = episodes.findIndex((entry) => entry.id === episode.id);
            return (
              <div key={episode.id} className={`list-item navidrome-song-item${episode.finished ? ' episode-finished' : ''}`}>
               <span className="idx">{episode.episode || episodeIndex + 1}</span>
               <span className="name"><span className="song-title">{episode.title}</span><span className="song-artist">{fmt(episode.duration)}{episode.finished && <span className="episode-finished-label">Finished</span>}</span></span>
               <div className="actions"><button className="xs secondary" onClick={() => enqueue(selectedItem.id, episode.id)}>+Q</button><button className="xs" onClick={() => play(selectedItem.id, episode.id)}>▶</button>{episode.finished ? <span className="episode-complete-icon" title="Finished" aria-label="Finished">✓</span> : <button className="xs finish-episode" disabled={finishingId === episode.id} onClick={() => markFinished(selectedItem, episode.id, episode.duration)}>{finishingId === episode.id ? 'Saving…' : 'Finish'}</button>}</div>
             </div>
            );
          })}
          {filteredEpisodes.length === 0 && <p className="empty-state episode-filter-empty">No {episodeFilter} episodes.</p>}
        </div></> : selectedItem.chapters?.length > 0 ? <div className="list navidrome-list">
          {selectedItem.chapters.map((chapter, index) => <div key={chapter.id ?? index} className="list-item navidrome-song-item"><span className="idx">{index + 1}</span><span className="name"><span className="song-title">{chapter.title}</span><span className="song-artist">{fmt(chapter.start)}{chapter.end ? ` – ${fmt(chapter.end)}` : ''}</span></span><button className="xs" onClick={() => playChapter(selectedItem.id, chapter)}>▶</button></div>)}
        </div> : <div className="detail-actions"><p className="empty-state">This item can be played as a book.</p><button className="sm" onClick={() => play(selectedItem.id)}>▶ Play / resume</button></div>}
      </>}
      {section === 'browse' && !loading && !selectedItem && <div className="list navidrome-list">
        {items.length === 0 ? <p className="empty-state">No audiobooks found</p> : items.map((item) => (
          <div key={item.id} className="list-item navidrome-item audiobook-item" onClick={() => openItem(item.id)}>
            {item.coverArt ? <img className="navidrome-thumb" src={item.coverArt} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'flex'; }} /> : null}
            <span className="navidrome-icon audiobook-fallback" style={{ display: item.coverArt ? 'none' : 'flex' }}>📚</span>
            <span className="name"><span className="song-title">{item.title}</span><span className="song-artist">{item.author}{item.series ? ` · ${item.series}` : ''}</span></span>
            <span className="navidrome-meta">{item.finished ? 'Completed' : item.progress > 0 ? `${Math.round((item.progress / item.duration) * 100)}% · In progress` : fmt(item.duration)}</span>
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
