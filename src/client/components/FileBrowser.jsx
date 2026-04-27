import { useState, useRef } from 'react';
import { api } from '../api';

export default function FileBrowser({ guildId, files, onFilesChanged, onQueueUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const doUpload = async (fileList) => {
    const arr = Array.from(fileList).filter((f) => /\.(mp3|wav|ogg|flac|m4a|webm|opus)$/i.test(f.name));
    if (!arr.length) return;
    setUploading(true);
    setUploadMsg(`Uploading ${arr.length}...`);
    try {
      const r = await api.uploadFiles(arr);
      setUploadMsg(r.success ? `Uploaded ${r.files.length}` : r.error);
      setTimeout(() => setUploadMsg(''), 2000);
      if (r.success) onFilesChanged();
    } catch { setUploadMsg('Upload failed'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files); };

  return (
    <>
      <div className="file-header">
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{files.length} tracks</span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {files.length > 0 && <button className="xs secondary" onClick={() => api.addToQueue(guildId, files).then(onQueueUpdate)}>+ All to Queue</button>}
          <button className="xs" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? '...' : 'Upload'}</button>
          <input ref={fileRef} type="file" accept=".mp3,.wav,.ogg,.flac,.m4a,.webm,.opus" multiple onChange={(e) => doUpload(e.target.files)} style={{ display: 'none' }} />
        </div>
      </div>

      {uploadMsg && <p className="upload-progress">{uploadMsg}</p>}

      {files.length === 0 ? (
        <div className="upload-area" onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}>
          Drop audio files here or click to upload
        </div>
      ) : (
        <div className="list">
          {files.map((f) => (
            <div key={f} className="list-item">
              <span className="name">🎵 {f}</span>
              <div className="actions">
                <button className="xs" onClick={() => api.play(guildId, f).then(onQueueUpdate)}>▶</button>
                <button className="xs secondary" onClick={() => api.addToQueue(guildId, [f]).then(onQueueUpdate)}>+Q</button>
                <button className="xs danger" onClick={async () => { await api.deleteFile(f); onFilesChanged(); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
