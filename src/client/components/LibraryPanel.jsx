import { useState, useRef } from 'react';
import { api } from '../api';
import FileBrowser from './FileBrowser';
import PlaylistManager from './PlaylistManager';

export default function LibraryPanel({ guildId, files, onFilesChanged, onQueueUpdate }) {
  const [tab, setTab] = useState('files');

  return (
    <div className="card">
      <div className="section-tabs">
        <button className={`section-tab ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>Files</button>
        <button className={`section-tab ${tab === 'playlists' ? 'active' : ''}`} onClick={() => setTab('playlists')}>Playlists</button>
      </div>

      {tab === 'files' ? (
        <FileBrowser guildId={guildId} files={files} onFilesChanged={onFilesChanged} onQueueUpdate={onQueueUpdate} />
      ) : (
        <PlaylistManager guildId={guildId} files={files} onQueueUpdate={onQueueUpdate} />
      )}
    </div>
  );
}
