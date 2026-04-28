import crypto from 'crypto';

function generateToken(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const token = crypto.createHash('md5').update(password + salt).digest('hex');
  return { token, salt };
}

export class NavidromeClient {
  constructor(url, username, password, internalUrl) {
    this.baseUrl = url.replace(/\/+$/, '');
    this.streamBaseUrl = (internalUrl || url).replace(/\/+$/, '');
    this.username = username;
    this.password = password;
    this.available = !!(url && username && password);
    console.log(`[Navidrome] Initialized — url: ${this.baseUrl}, streamUrl: ${this.streamBaseUrl}, user: ${this.username}, available: ${this.available}`);
  }

  async _request(endpoint, params = {}) {
    if (!this.available) throw new Error('Navidrome not configured');
    const { token, salt } = generateToken(this.password);
    const query = new URLSearchParams({
      u: this.username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'radio-discord-bot',
      f: 'json',
      ...params,
    });
    const url = `${this.baseUrl}/rest/${endpoint}?${query}`;
    console.log(`[Navidrome] Requesting: ${url}`);
    const res = await fetch(url);
    console.log(`[Navidrome] Response status: ${res.status}`);
    const data = await res.json();
    console.log(`[Navidrome] Response body:`, JSON.stringify(data));
    const subsonicResponse = data['subsonic-response'];
    if (!subsonicResponse || subsonicResponse.status !== 'ok') {
      throw new Error(subsonicResponse?.error?.message || 'Subsonic API error');
    }
    return subsonicResponse;
  }

  getStreamUrl(songId) {
    if (!this.available) return null;
    const { token, salt } = generateToken(this.password);
    const params = new URLSearchParams({
      u: this.username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'radio-discord-bot',
      id: songId,
    });
    return `${this.streamBaseUrl}/rest/stream?${params}`;
  }

  getCoverArtUrl(coverArtId) {
    if (!this.available || !coverArtId) return null;
    const { token, salt } = generateToken(this.password);
    const params = new URLSearchParams({
      u: this.username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'radio-discord-bot',
      id: coverArtId,
      size: '300',
    });
    return `${this.streamBaseUrl}/rest/getCoverArt?${params}`;
  }

  async ping() {
    const res = await this._request('ping.view');
    return { ok: true, version: res.version };
  }

  async getArtists() {
    const res = await this._request('getArtists');
    const indices = res.artists?.index || [];
    const artists = [];
    for (const idx of indices) {
      for (const artist of idx.artist || []) {
        artists.push({
          id: artist.id,
          name: artist.name,
          albumCount: artist.albumCount,
          coverArt: artist.coverArt,
        });
      }
    }
    return artists;
  }

  async getArtist(artistId) {
    const res = await this._request('getArtist', { id: artistId });
    const artist = res.artist;
    return {
      id: artist.id,
      name: artist.name,
      albumCount: artist.albumCount,
      coverArt: artist.coverArt,
      albums: (artist.album || []).map((a) => ({
        id: a.id,
        name: a.name,
        year: a.year,
        songCount: a.songCount,
        coverArt: a.coverArt,
      })),
    };
  }

  async getAlbum(albumId) {
    const res = await this._request('getAlbum', { id: albumId });
    const album = res.album;
    return {
      id: album.id,
      name: album.name,
      artist: album.artist,
      year: album.year,
      songCount: album.songCount,
      coverArt: album.coverArt,
      songs: (album.song || []).map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        track: s.track,
        coverArt: s.coverArt,
      })),
    };
  }

  async search(query) {
    const res = await this._request('search3', { query });
    const result = res.searchResult3 || {};
    return {
      artists: (result.artist || []).map((a) => ({
        id: a.id,
        name: a.name,
        albumCount: a.albumCount,
        coverArt: a.coverArt,
      })),
      albums: (result.album || []).map((a) => ({
        id: a.id,
        name: a.name,
        artist: a.artist,
        year: a.year,
        songCount: a.songCount,
        coverArt: a.coverArt,
      })),
      songs: (result.song || []).map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        track: s.track,
        coverArt: s.coverArt,
      })),
    };
  }

  async getSong(songId) {
    const res = await this._request('getSong', { id: songId });
    const s = res.song;
    return {
      id: s.id,
      title: s.title,
      artist: s.artist,
      album: s.album,
      duration: s.duration,
      track: s.track,
      coverArt: s.coverArt,
    };
  }

  async getPlaylists() {
    const res = await this._request('getPlaylists');
    const playlists = res.playlists?.playlist || [];
    return playlists.map((p) => ({
      id: p.id,
      name: p.name,
      songCount: p.songCount,
      duration: p.duration,
      coverArt: p.coverArt,
    }));
  }

  async getPlaylist(playlistId) {
    const res = await this._request('getPlaylist', { id: playlistId });
    const pl = res.playlist;
    return {
      id: pl.id,
      name: pl.name,
      songCount: pl.songCount,
      duration: pl.duration,
      songs: (pl.entry || []).map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        track: s.track,
        coverArt: s.coverArt,
      })),
    };
  }
}
