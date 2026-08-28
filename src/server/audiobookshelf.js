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

  async getItem(itemId) {
    return this._request(`/api/items/${encodeURIComponent(itemId)}?expanded=1&include=progress`);
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
    const podcastEpisodes = item.media?.episodes || item.media?.metadata?.episodes || [];
    return {
      id: item.id,
      title: metadata.title || item.title || 'Untitled',
      author: metadata.author || authors.map((a) => a.name).join(', ') || 'Unknown author',
      series: metadata.seriesName || metadata.series?.[0]?.name || '',
      mediaType: item.mediaType,
      duration: item.media?.duration || 0,
      coverArt: this.getCoverUrl(item.id, item.updatedAt),
      progress: item.userMediaProgress?.currentTime || 0,
      finished: !!item.userMediaProgress?.isFinished,
      episodes: podcastEpisodes.map((episode) => ({
        id: episode.id,
        title: episode.title || episode.displayTitle || episode.episodeDisplayTitle || 'Untitled episode',
        duration: episode.duration || episode.audioTrack?.duration || episode.audioFile?.duration || 0,
        episode: episode.episode,
        season: episode.season,
      })),
    };
  }
}
