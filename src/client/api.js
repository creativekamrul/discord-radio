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
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}

async function requestBlob(url) {
  const res = await fetch(`${BASE}${url}`, { headers: getHeaders() });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Image request failed (${res.status})`);
  }
  return res.blob();
}

export const api = {
  getConfig: () => request('GET', '/config'),
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
  navidromeStatus: () => request('GET', '/navidrome/status'),
  navidromeArtists: () => request('GET', '/navidrome/artists'),
  navidromeArtist: (id) => request('GET', `/navidrome/artists/${id}`),
  navidromeSong: (id) => request('GET', `/navidrome/songs/${id}`),
  navidromeAlbums: (type = 'alphabeticalByName') => request('GET', `/navidrome/albums?type=${encodeURIComponent(type)}`),
  navidromeAlbum: (id) => request('GET', `/navidrome/albums/${id}`),
  navidromeSearch: (query) => request('GET', `/navidrome/search?query=${encodeURIComponent(query)}`),
  navidromePlaySong: (guildId, songId, collection) => request('POST', `/navidrome/play/${guildId}/${songId}`, collection ? { collection } : {}),
  navidromeEnqueueSong: (guildId, songId, collection) => request('POST', `/navidrome/enqueue/${guildId}/${songId}`, collection ? { collection } : {}),
  navidromePlayAlbum: (guildId, albumId) => request('POST', `/navidrome/play-album/${guildId}/${albumId}`),
  navidromeQueueAlbum: (guildId, albumId) => request('POST', `/navidrome/queue-album/${guildId}/${albumId}`),
  navidromeCoverUrl: (coverArtId) => coverArtId ? `${BASE}/navidrome/cover/${coverArtId}` : null,
  navidromeCoverBlob: (coverArtId) => requestBlob(`/navidrome/cover/${encodeURIComponent(coverArtId)}`),
  navidromePlaylists: () => request('GET', '/navidrome/playlists'),
  navidromePlaylist: (id) => request('GET', `/navidrome/playlists/${id}`),
  navidromePlayPlaylist: (guildId, id) => request('POST', `/navidrome/play-playlist/${guildId}/${id}`),
  navidromeQueuePlaylist: (guildId, id) => request('POST', `/navidrome/queue-playlist/${guildId}/${id}`),
  audiobookshelfStatus: () => request('GET', '/audiobookshelf/status'),
  audiobookshelfLibraries: () => request('GET', '/audiobookshelf/libraries'),
  audiobookshelfItems: (id) => request('GET', `/audiobookshelf/libraries/${id}/items`),
  audiobookshelfSearch: (id, query) => request('GET', `/audiobookshelf/libraries/${id}/search?query=${encodeURIComponent(query)}`),
  audiobookshelfPlay: (guildId, id, episodeId) => request('POST', `/audiobookshelf/play/${guildId}/${id}`, episodeId ? { episodeId } : {}),
  audiobookshelfQueue: (guildId, id, episodeId) => request('POST', `/audiobookshelf/queue/${guildId}/${id}`, episodeId ? { episodeId } : {}),
  audiobookshelfItem: (id) => request('GET', `/audiobookshelf/items/${id}`),
  audiobookshelfContinue: () => request('GET', '/audiobookshelf/continue-listening'),
  audiobookshelfProgress: (id, data) => request('PATCH', `/audiobookshelf/progress/${id}`, data),
};
