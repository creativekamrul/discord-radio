import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { getAudioDuration } from './player.js';
import { NavidromeClient } from './navidrome.js';

const PLAYLISTS_FILE = 'playlists.json';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, req._audioDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-\s]/g, '');
    let name = `${base}${ext}`;
    if (fs.existsSync(path.join(req._audioDir, name))) {
      name = `${base}_${Date.now()}${ext}`;
    }
    cb(null, name);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm', '.opus'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 1024 * 1024 * 1024 },
});

export function createAPIRoutes(bot, audioDir) {
  const router = Router();
  const resolvedAudioDir = path.resolve(audioDir);

  function loadPlaylists() {
    const fp = path.resolve(PLAYLISTS_FILE);
    if (!fs.existsSync(fp)) return [];
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  }

  function savePlaylists(data) {
    fs.writeFileSync(path.resolve(PLAYLISTS_FILE), JSON.stringify(data, null, 2));
  }

  router.use((req, res, next) => {
    req._audioDir = resolvedAudioDir;
    next();
  });

  function resolve(filePath) {
    const base = path.basename(filePath);
    return path.join(resolvedAudioDir, base);
  }

  router.get('/guilds', (req, res) => {
    res.json(bot.getGuilds());
  });

  router.get('/guilds/:guildId/channels', (req, res) => {
    res.json(bot.getVoiceChannels(req.params.guildId));
  });

  router.get('/guilds/:guildId/connected', (req, res) => {
    res.json(bot.getConnectedChannel(req.params.guildId));
  });

  router.post('/bot/join', (req, res) => {
    const { guildId, channelId } = req.body;
    res.json(bot.joinChannel(guildId, channelId));
  });

  router.post('/bot/leave', (req, res) => {
    res.json(bot.leaveChannel(req.body.guildId));
  });

  router.get('/audio/files', (req, res) => {
    if (!fs.existsSync(resolvedAudioDir)) return res.json([]);
    const extensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm', '.opus'];
    const files = fs
      .readdirSync(resolvedAudioDir)
      .filter((f) => extensions.some((ext) => f.toLowerCase().endsWith(ext)))
      .sort();
    res.json(files);
  });

  router.post('/audio/upload', upload.array('files', 50), (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No valid audio files uploaded' });
    }
    res.json({
      success: true,
      files: req.files.map((f) => f.filename),
    });
  });

  router.delete('/audio/files/:filename', (req, res) => {
    const filePath = path.join(resolvedAudioDir, path.basename(req.params.filename));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  });

  router.get('/player/:guildId/status', (req, res) => {
    res.json(bot.getPlayer(req.params.guildId).getStatus());
  });

  router.post('/player/:guildId/play', (req, res) => {
    const { guildId } = req.params;
    const { file, url, title, duration } = req.body;
    const player = bot.getPlayer(guildId);
    if (url) {
      const ok = player.playNowUrl(url, title, duration);
      res.json(ok ? { success: true } : { error: 'Failed to play URL' });
    } else if (file) {
      const ok = player.playNow(resolve(file));
      res.json(ok ? { success: true } : { error: 'Failed to play file' });
    } else {
      const ok = player.play();
      res.json(ok ? { success: true } : { error: 'Nothing to play' });
    }
  });

  router.post('/player/:guildId/queue/play', (req, res) => {
    const player = bot.getPlayer(req.params.guildId);
    const ok = player.playQueueIndex(req.body.index);
    res.json(ok ? { success: true } : { error: 'Cannot play track' });
  });

  router.post('/player/:guildId/pause', (req, res) => {
    res.json(bot.getPlayer(req.params.guildId).pause() ? { success: true } : { error: 'Cannot pause' });
  });

  router.post('/player/:guildId/resume', (req, res) => {
    res.json(bot.getPlayer(req.params.guildId).resume() ? { success: true } : { error: 'Cannot resume' });
  });

  router.post('/player/:guildId/stop', (req, res) => {
    bot.getPlayer(req.params.guildId).stop();
    res.json({ success: true });
  });

  router.post('/player/:guildId/skip', (req, res) => {
    bot.getPlayer(req.params.guildId).skip();
    res.json({ success: true });
  });

  router.post('/player/:guildId/volume', (req, res) => {
    bot.getPlayer(req.params.guildId).setVolume(req.body.volume);
    res.json({ success: true });
  });

  router.post('/player/:guildId/queue/add', (req, res) => {
    const player = bot.getPlayer(req.params.guildId);
    const added = [];
    for (const f of req.body.files) {
      if (typeof f === 'object' && f.url) {
        player.addToQueueUrl(f.url, f.title, f.duration);
        added.push(f.title || f.url);
      } else {
        const name = typeof f === 'string' ? f : f.path;
        if (player.addToQueue(resolve(name))) added.push(name);
      }
    }
    res.json({ success: true, added });
  });

  router.post('/player/:guildId/queue/remove', (req, res) => {
    res.json(bot.getPlayer(req.params.guildId).removeFromQueue(req.body.index) ? { success: true } : { error: 'Invalid index' });
  });

  router.post('/player/:guildId/queue/clear', (req, res) => {
    bot.getPlayer(req.params.guildId).clearQueue();
    res.json({ success: true });
  });

  router.post('/player/:guildId/loop', (req, res) => {
    bot.getPlayer(req.params.guildId).setLoop(req.body.mode);
    res.json({ success: true });
  });

  router.post('/player/:guildId/shuffle', (req, res) => {
    res.json({ success: true, shuffled: bot.getPlayer(req.params.guildId).toggleShuffle() });
  });

  router.post('/player/:guildId/seek', (req, res) => {
    const ok = bot.getPlayer(req.params.guildId).seekTo(req.body.seconds);
    res.json(ok ? { success: true } : { error: 'Cannot seek' });
  });

  router.post('/player/:guildId/previous', (req, res) => {
    const ok = bot.getPlayer(req.params.guildId).previous();
    res.json(ok ? { success: true } : { error: 'No previous track' });
  });

  router.get('/audio/duration/:filename', async (req, res) => {
    const filePath = path.join(resolvedAudioDir, path.basename(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const duration = await getAudioDuration(filePath);
    res.json({ duration });
  });

  router.get('/playlists', (req, res) => {
    res.json(loadPlaylists());
  });

  router.post('/playlists', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const lists = loadPlaylists();
    const pl = { id: Date.now().toString(36), name, tracks: [] };
    lists.push(pl);
    savePlaylists(lists);
    res.json(pl);
  });

  router.put('/playlists/:id', (req, res) => {
    const lists = loadPlaylists();
    const pl = lists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    if (req.body.name) pl.name = req.body.name;
    savePlaylists(lists);
    res.json(pl);
  });

  router.delete('/playlists/:id', (req, res) => {
    let lists = loadPlaylists();
    lists = lists.filter((p) => p.id !== req.params.id);
    savePlaylists(lists);
    res.json({ success: true });
  });

  router.post('/playlists/:id/tracks', (req, res) => {
    const lists = loadPlaylists();
    const pl = lists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    for (const f of req.body.files) {
      if (!pl.tracks.includes(f)) pl.tracks.push(f);
    }
    savePlaylists(lists);
    res.json(pl);
  });

  router.delete('/playlists/:id/tracks', (req, res) => {
    const lists = loadPlaylists();
    const pl = lists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    pl.tracks = pl.tracks.filter((t) => !req.body.files.includes(t));
    savePlaylists(lists);
    res.json(pl);
  });

  router.post('/playlists/:id/play', (req, res) => {
    const lists = loadPlaylists();
    const pl = lists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    const player = bot.getPlayer(req.body.guildId);
    player.clearQueue();
    for (const f of pl.tracks) {
      player.addToQueue(resolve(f));
    }
    const ok = player.play();
    res.json(ok ? { success: true } : { error: 'Failed to play playlist' });
  });

  router.post('/playlists/:id/enqueue', (req, res) => {
    const lists = loadPlaylists();
    const pl = lists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    const player = bot.getPlayer(req.body.guildId);
    for (const f of pl.tracks) {
      player.addToQueue(resolve(f));
    }
    res.json({ success: true, added: pl.tracks.length });
  });

  // Navidrome routes
  const navidrome = new NavidromeClient(
    process.env.NAVIDROME_URL,
    process.env.NAVIDROME_USER,
    process.env.NAVIDROME_PASSWORD
  );

  router.get('/navidrome/status', (_req, res) => {
    res.json({ available: navidrome.available });
  });

  router.get('/navidrome/ping', async (_req, res) => {
    if (!navidrome.available) return res.status(503).json({ error: 'Navidrome not configured' });
    try {
      const result = await navidrome.ping();
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get('/navidrome/artists', async (_req, res) => {
    try {
      const artists = await navidrome.getArtists();
      res.json(artists);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get('/navidrome/artists/:id', async (req, res) => {
    try {
      const artist = await navidrome.getArtist(req.params.id);
      res.json(artist);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get('/navidrome/albums/:id', async (req, res) => {
    try {
      const album = await navidrome.getAlbum(req.params.id);
      res.json(album);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get('/navidrome/search', async (req, res) => {
    try {
      const results = await navidrome.search(req.query.query || '');
      res.json(results);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get('/navidrome/stream-url/:songId', (req, res) => {
    const url = navidrome.getStreamUrl(req.params.songId);
    if (!url) return res.status(503).json({ error: 'Navidrome not configured' });
    res.json({ url });
  });

  router.post('/navidrome/play/:guildId/:songId', async (req, res) => {
    try {
      const song = await navidrome.getSong(req.params.songId);
      const streamUrl = navidrome.getStreamUrl(req.params.songId);
      if (!streamUrl) return res.status(503).json({ error: 'Navidrome not configured' });
      const title = `${song.artist} - ${song.title}`;
      const player = bot.getPlayer(req.params.guildId);
      const ok = player.playNowUrl(streamUrl, title, song.duration);
      res.json(ok ? { success: true } : { error: 'Failed to play' });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/navidrome/enqueue/:guildId/:songId', async (req, res) => {
    try {
      const song = await navidrome.getSong(req.params.songId);
      const streamUrl = navidrome.getStreamUrl(req.params.songId);
      if (!streamUrl) return res.status(503).json({ error: 'Navidrome not configured' });
      const title = `${song.artist} - ${song.title}`;
      const player = bot.getPlayer(req.params.guildId);
      player.addToQueueUrl(streamUrl, title, song.duration);
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/navidrome/queue-album/:guildId/:albumId', async (req, res) => {
    try {
      const album = await navidrome.getAlbum(req.params.albumId);
      const player = bot.getPlayer(req.params.guildId);
      for (const song of album.songs) {
        const streamUrl = navidrome.getStreamUrl(song.id);
        if (streamUrl) {
          const title = `${song.artist} - ${song.title}`;
          player.addToQueueUrl(streamUrl, title, song.duration);
        }
      }
      res.json({ success: true, added: album.songs.length });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/navidrome/play-album/:guildId/:albumId', async (req, res) => {
    try {
      const album = await navidrome.getAlbum(req.params.albumId);
      const player = bot.getPlayer(req.params.guildId);
      player.clearQueue();
      for (const song of album.songs) {
        const streamUrl = navidrome.getStreamUrl(song.id);
        if (streamUrl) {
          const title = `${song.artist} - ${song.title}`;
          player.addToQueueUrl(streamUrl, title, song.duration);
        }
      }
      const ok = player.play();
      res.json(ok ? { success: true } : { error: 'Failed to play album' });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get('/navidrome/cover/:coverArtId', async (req, res) => {
    const url = navidrome.getCoverArtUrl(req.params.coverArtId);
    if (!url) return res.status(404).json({ error: 'No cover art' });
    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) return res.status(502).json({ error: 'Failed to fetch cover' });
      res.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=3600');
      const buf = Buffer.from(await imgRes.arrayBuffer());
      res.send(buf);
    } catch {
      res.status(502).json({ error: 'Failed to fetch cover' });
    }
  });

  router.get('/navidrome/playlists', async (_req, res) => {
    try {
      const playlists = await navidrome.getPlaylists();
      res.json(playlists);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get('/navidrome/playlists/:id', async (req, res) => {
    try {
      const playlist = await navidrome.getPlaylist(req.params.id);
      res.json(playlist);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/navidrome/play-playlist/:guildId/:id', async (req, res) => {
    try {
      const pl = await navidrome.getPlaylist(req.params.id);
      const player = bot.getPlayer(req.params.guildId);
      player.clearQueue();
      for (const song of pl.songs) {
        const streamUrl = navidrome.getStreamUrl(song.id);
        if (streamUrl) {
          const title = `${song.artist} - ${song.title}`;
          player.addToQueueUrl(streamUrl, title, song.duration);
        }
      }
      const ok = player.play();
      res.json(ok ? { success: true } : { error: 'Failed to play playlist' });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/navidrome/queue-playlist/:guildId/:id', async (req, res) => {
    try {
      const pl = await navidrome.getPlaylist(req.params.id);
      const player = bot.getPlayer(req.params.guildId);
      for (const song of pl.songs) {
        const streamUrl = navidrome.getStreamUrl(song.id);
        if (streamUrl) {
          const title = `${song.artist} - ${song.title}`;
          player.addToQueueUrl(streamUrl, title, song.duration);
        }
      }
      res.json({ success: true, added: pl.songs.length });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}
