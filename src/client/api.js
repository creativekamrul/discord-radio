const BASE = '/api';

function getHeaders() {
  const password = localStorage.getItem('dashboardPassword');
  const headers = { 'Content-Type': 'application/json' };
  if (password) headers['X-Dashboard-Password'] = password;
  return headers;
}

async function request(method, url, body) {
  const opts = { method, headers: getHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${url}`, opts);
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  return res.json();
}

export const api = {
  getGuilds: () => request('GET', '/guilds'),
  getChannels: (guildId) => request('GET', `/guilds/${guildId}/channels`),
  getConnected: (guildId) => request('GET', `/guilds/${guildId}/connected`),
  joinChannel: (guildId, channelId) => request('POST', '/bot/join', { guildId, channelId }),
  leaveChannel: (guildId) => request('POST', '/bot/leave', { guildId }),
  getAudioFiles: () => request('GET', '/audio/files'),
  getAudioDuration: (filename) => request('GET', `/audio/duration/${encodeURIComponent(filename)}`),
  uploadFiles: async (files) => {
    const password = localStorage.getItem('dashboardPassword');
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const res = await fetch(`${BASE}/audio/upload`, {
      method: 'POST',
      headers: password ? { 'X-Dashboard-Password': password } : {},
      body: form,
    });
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    return res.json();
  },
  deleteFile: (filename) => request('DELETE', `/audio/files/${encodeURIComponent(filename)}`),
  getStatus: (guildId) => request('GET', `/player/${guildId}/status`),
  play: (guildId, file) => request('POST', `/player/${guildId}/play`, { file }),
  pause: (guildId) => request('POST', `/player/${guildId}/pause`),
  resume: (guildId) => request('POST', `/player/${guildId}/resume`),
  stop: (guildId) => request('POST', `/player/${guildId}/stop`),
  skip: (guildId) => request('POST', `/player/${guildId}/skip`),
  previous: (guildId) => request('POST', `/player/${guildId}/previous`),
  seek: (guildId, seconds) => request('POST', `/player/${guildId}/seek`, { seconds }),
  setVolume: (guildId, volume) => request('POST', `/player/${guildId}/volume`, { volume }),
  addToQueue: (guildId, files) => request('POST', `/player/${guildId}/queue/add`, { files }),
  removeFromQueue: (guildId, index) => request('POST', `/player/${guildId}/queue/remove`, { index }),
  playQueueIndex: (guildId, index) => request('POST', `/player/${guildId}/queue/play`, { index }),
  clearQueue: (guildId) => request('POST', `/player/${guildId}/queue/clear`),
  setLoop: (guildId, mode) => request('POST', `/player/${guildId}/loop`, { mode }),
  toggleShuffle: (guildId) => request('POST', `/player/${guildId}/shuffle`),
  getPlaylists: () => request('GET', '/playlists'),
  createPlaylist: (name) => request('POST', '/playlists', { name }),
  updatePlaylist: (id, data) => request('PUT', `/playlists/${id}`, data),
  deletePlaylist: (id) => request('DELETE', `/playlists/${id}`),
  addPlaylistTracks: (id, files) => request('POST', `/playlists/${id}/tracks`, { files }),
  removePlaylistTracks: (id, files) => request('DELETE', `/playlists/${id}/tracks`, { files }),
  playPlaylist: (guildId, id) => request('POST', `/playlists/${id}/play`, { guildId }),
  enqueuePlaylist: (guildId, id) => request('POST', `/playlists/${id}/enqueue`, { guildId }),
};
