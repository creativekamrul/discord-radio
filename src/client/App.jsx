import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import ChannelBar from './components/ChannelBar';
import PlayerSection from './components/PlayerSection';
import QueuePanel from './components/QueuePanel';
import LibraryPanel from './components/LibraryPanel';
import './App.css';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [connectedChannel, setConnectedChannel] = useState(null);
  const [status, setStatus] = useState(null);
  const [audioFiles, setAudioFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);
  const statusRef = useRef(null);
  statusRef.current = status;

  useEffect(() => {
    const saved = localStorage.getItem('dashboardPassword');
    if (saved) {
      api.getGuilds().then(() => setAuthed(true)).catch(() => localStorage.removeItem('dashboardPassword'));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!password) return;
    localStorage.setItem('dashboardPassword', password);
    api.getGuilds().then(() => { setAuthed(true); setAuthError(''); })
      .catch(() => { localStorage.removeItem('dashboardPassword'); setAuthError('Invalid password'); });
  };

  const handleLogout = () => {
    localStorage.removeItem('dashboardPassword');
    setAuthed(false);
    setPassword('');
  };

  const loadData = useCallback(async () => {
    try {
      const [g, f] = await Promise.all([api.getGuilds(), api.getAudioFiles()]);
      setGuilds(g);
      setAudioFiles(f);
      if (g.length > 0 && !selectedGuild) setSelectedGuild(g[0].id);
      setLoading(false);
    } catch { setLoading(false); }
  }, []);

  const refreshFiles = useCallback(async () => {
    try { setAudioFiles(await api.getAudioFiles()); } catch {}
  }, []);

  const pollStatus = useCallback(async () => {
    if (!selectedGuild) return;
    try {
      const [s, ch] = await Promise.all([api.getStatus(selectedGuild), api.getConnected(selectedGuild)]);
      setStatus(s);
      setConnectedChannel(ch);
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') handleLogout();
    }
  }, [selectedGuild]);

  useEffect(() => { if (authed) loadData(); }, [authed]);

  useEffect(() => {
    if (!authed || !selectedGuild) return;
    pollStatus();
    pollRef.current = setInterval(pollStatus, 1000);
    return () => clearInterval(pollRef.current);
  }, [authed, pollStatus]);

  if (loading) {
    return (<div className="password-gate"><div className="password-card"><h1>📻 Radio Bot</h1><p>Loading...</p></div></div>);
  }

  if (!authed) {
    return (
      <div className="password-gate">
        <div className="password-card">
          <h1>📻 Radio Bot</h1>
          <p>Enter dashboard password</p>
          {authError && <p className="auth-error">{authError}</p>}
          <form onSubmit={handleLogin}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoFocus />
            <button type="submit">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📻 Radio Bot</h1>
        <div className="header-right">
          <select value={selectedGuild || ''} onChange={(e) => setSelectedGuild(e.target.value)}>
            {guilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className="secondary sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {guilds.length === 0 ? (
        <div className="card setup-card">
          <h2>Setup Required</h2>
          <p>The bot isn't in any Discord server yet.</p>
          <a href="https://discord.com/oauth2/authorize?client_id=1498074269090058312&scope=bot&permissions=3146752"
             target="_blank" rel="noreferrer" className="invite-link">Invite Bot</a>
          <button className="secondary" onClick={loadData} style={{ marginTop: '1rem' }}>Retry</button>
        </div>
      ) : selectedGuild && (
        <>
          <ChannelBar guildId={selectedGuild} connectedChannel={connectedChannel} onUpdate={pollStatus} />
          <div className="main-grid">
            <PlayerSection guildId={selectedGuild} status={status} onUpdate={pollStatus} />
            <QueuePanel guildId={selectedGuild} status={status} onUpdate={pollStatus} />
            <LibraryPanel guildId={selectedGuild} files={audioFiles} onFilesChanged={refreshFiles} onQueueUpdate={pollStatus} />
          </div>
        </>
      )}
    </div>
  );
}
