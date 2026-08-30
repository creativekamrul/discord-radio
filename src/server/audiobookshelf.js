function findAudioFileName(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 4) return '';
  for (const key of ['filename', 'fileName']) {
    if (typeof value[key] === 'string' && value[key]) return value[key];
  }
  if (typeof value.path === 'string' && value.path) return value.path.split(/[\\/]/).pop();
  for (const key of ['audioFile', 'audioTrack', 'file', 'enclosure', 'metadata']) {
    const found = findAudioFileName(value[key], depth + 1);
    if (found) return found;
  }
  return '';
}

export class AudiobookshelfClient {
  constructor(url, token, internalUrl) {
    this.baseUrl = (url || '').replace(/\/+$/, '');
    this.streamBaseUrl = (internalUrl || url || '').replace(/\/+$/, '');
    this.token = token;
    this.available = !!(this.baseUrl && this.token);
    console.log(`[Audiobookshelf] Initialized — url: ${this.baseUrl}, streamUrl: ${this.streamBaseUrl}, available: ${this.available}`);
  }

  async _request(endpoint, options = {}) {
    if (!this.available) throw new Error('Audiobookshelf not configured');
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { Authorization: `Bearer ${this.token}`, ...(options.headers || {}) },
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) throw new Error(data.error || data.message || `Audiobookshelf request failed (${res.status})`);
    return data;
  }

  _streamUrl(contentUrl) {
    const url = new URL(contentUrl, `${this.streamBaseUrl}/`);
    url.searchParams.set('token', this.token);
    return url.toString();
  }

  async ping() { await this._request('/api/me'); return { ok: true }; }
  async getMe() { return this._request('/api/me'); }
  async getLibraries() {
    const result = await this._request('/api/libraries');
    return result.libraries || [];
  }

  async getLibraryItems(libraryId, query = {}) {
    const params = new URLSearchParams({ limit: '0', minified: '1', ...query });
    return this._request(`/api/libraries/${encodeURIComponent(libraryId)}/items?${params}`);
  }

  async searchLibrary(libraryId, query) {
    const params = new URLSearchParams({ q: query, limit: '50' });
    return this._request(`/api/libraries/${encodeURIComponent(libraryId)}/search?${params}`);
  }

  async getItem(itemId, episodeId = null) {
    const episode = episodeId ? `&episode=${encodeURIComponent(episodeId)}` : '';
    return this._request(`/api/items/${encodeURIComponent(itemId)}?expanded=1&include=progress${episode}`);
  }

  async getProgress(itemId, episodeId = null) {
    const suffix = episodeId ? `/${encodeURIComponent(episodeId)}` : '';
    return this._request(`/api/me/progress/${encodeURIComponent(itemId)}${suffix}`);
  }

  async updateProgress(itemId, episodeId, data) {
    const suffix = episodeId ? `/${encodeURIComponent(episodeId)}` : '';
    return this._request(`/api/me/progress/${encodeURIComponent(itemId)}${suffix}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
  }

  async getItemsInProgress(limit = 25) {
    return this._request(`/api/me/items-in-progress?limit=${encodeURIComponent(limit)}`);
  }

  async startPlayback(itemId, episodeId) {
    const endpoint = `/api/items/${encodeURIComponent(itemId)}/play${episodeId ? `/${encodeURIComponent(episodeId)}` : ''}`;
    const session = await this._request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaPlayer: 'radio-discord-bot', forceDirectPlay: true, supportedMimeTypes: ['audio/flac', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm'] }),
    });
    return { ...session, audioTracks: (session.audioTracks || []).map((track) => ({ ...track, contentUrl: this._streamUrl(track.contentUrl) })) };
  }

  async syncPlayback(sessionId, currentTime, timeListened, duration) {
    return this._request(`/api/session/${encodeURIComponent(sessionId)}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentTime, timeListened, duration }),
    });
  }

  async closePlayback(sessionId, currentTime, timeListened, duration) {
    return this._request(`/api/session/${encodeURIComponent(sessionId)}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentTime, timeListened, duration }),
    });
  }

  getCoverUrl(itemId, updatedAt) {
    if (!this.available || !itemId) return null;
    const url = new URL(`/api/items/${encodeURIComponent(itemId)}/cover`, `${this.streamBaseUrl}/`);
    url.searchParams.set('token', this.token);
    if (updatedAt) url.searchParams.set('ts', String(updatedAt));
    return url.toString();
  }

  normalizeItem(item) {
    const metadata = item.media?.metadata || {};
    const authors = metadata.authors || [];
    const progressEpisodeId = item.userMediaProgress?.episodeId || item.recentEpisode?.id;
    const podcastEpisodes = item.media?.episodes || item.media?.metadata?.episodes || [];
    const matchedEpisode = progressEpisodeId ? podcastEpisodes.find((episode) => episode.id === progressEpisodeId) : null;
    const recentEpisode = matchedEpisode || item.recentEpisode || null;
    const isPodcast = item.mediaType === 'podcast';
    const libraryTitle = metadata.title || item.title || 'Untitled';
    const episodeTitle = recentEpisode?.title || recentEpisode?.displayTitle || recentEpisode?.episodeDisplayTitle || recentEpisode?.subtitle || '';
    const episodeFileName = findAudioFileName(recentEpisode);
    return {
      id: item.id,
      title: libraryTitle,
      displayTitle: isPodcast && episodeTitle ? episodeTitle : libraryTitle,
      episodeTitle: isPodcast ? episodeTitle : '',
      episodeFileName: isPodcast ? episodeFileName : '',
      parentTitle: isPodcast && episodeTitle ? libraryTitle : '',
      author: metadata.author || authors.map((a) => a.name).join(', ') || 'Unknown author',
      series: metadata.seriesName || metadata.series?.[0]?.name || '',
      mediaType: item.mediaType,
      duration: item.media?.duration || 0,
      coverArt: this.getCoverUrl(item.id, item.updatedAt),
      progress: item.userMediaProgress?.currentTime || 0,
      progressPercent: item.userMediaProgress?.progress || 0,
      finished: !!item.userMediaProgress?.isFinished,
      recentEpisode: recentEpisode ? { id: recentEpisode.id, title: episodeTitle } : null,
      episodes: podcastEpisodes.map((episode) => ({
        id: episode.id,
        title: episode.title || episode.displayTitle || episode.episodeDisplayTitle || 'Untitled episode',
        fileName: findAudioFileName(episode),
        duration: episode.duration || episode.audioTrack?.duration || episode.audioFile?.duration || 0,
        episode: episode.episode,
        season: episode.season,
      })),
      chapters: (item.media?.chapters || []).map((chapter, index) => ({
        id: chapter.id ?? index,
        title: chapter.title || `Chapter ${index + 1}`,
        start: Number(chapter.start) || 0,
        end: Number(chapter.end) || 0,
      })),
    };
  }
}
