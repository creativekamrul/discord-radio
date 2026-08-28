import { useState } from 'react';
import NavidromePanel from './NavidromePanel';
import AudiobookshelfPanel from './AudiobookshelfPanel';

export default function MediaPanel({ guildId, onQueueUpdate }) {
  const [source, setSource] = useState('music');

  return (
    <div className="card media-panel">
      <div className="media-panel-header">
        <div><h2>Media Library</h2><p>Browse music, playlists, books, and podcasts</p></div>
      </div>
      <div className="media-tabs media-tabs-inline" role="tablist" aria-label="Media sources">
        <button className={`media-tab ${source === 'music' ? 'active' : ''}`} onClick={() => setSource('music')} role="tab" aria-selected={source === 'music'}>
          <span className="media-tab-icon">♫</span><span><strong>Music</strong><small>Navidrome</small></span>
        </button>
        <button className={`media-tab ${source === 'books' ? 'active' : ''}`} onClick={() => setSource('books')} role="tab" aria-selected={source === 'books'}>
          <span className="media-tab-icon">📚</span><span><strong>Books & Podcasts</strong><small>Audiobookshelf</small></span>
        </button>
      </div>
      {source === 'music' ? <NavidromePanel guildId={guildId} onQueueUpdate={onQueueUpdate} /> : <AudiobookshelfPanel guildId={guildId} onQueueUpdate={onQueueUpdate} />}
    </div>
  );
}
