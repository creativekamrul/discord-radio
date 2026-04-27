import './src/server/setup-ffmpeg.js';
import 'dotenv/config';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { RadioBot } from './src/server/bot.js';
import { createAPIRoutes } from './src/server/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const AUDIO_DIR = process.env.AUDIO_DIR || './audio';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  console.log(`[Setup] Created audio directory: ${path.resolve(AUDIO_DIR)}`);
}

const app = express();
app.use(express.json({ limit: '1mb' }));

if (DASHBOARD_PASSWORD) {
  app.use('/api', (req, res, next) => {
    if (req.headers['x-dashboard-password'] === DASHBOARD_PASSWORD) return next();
    if (req.headers.authorization === `Bearer ${DASHBOARD_PASSWORD}`) return next();
    res.status(401).json({ error: 'Unauthorized' });
  });
}

const TOKEN = process.env.DISCORD_TOKEN;
const bot = new RadioBot(TOKEN);

app.use('/api', createAPIRoutes(bot, AUDIO_DIR));

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

function startServer() {
  app.listen(PORT, () => {
    console.log(`[Server] Dashboard running at http://localhost:${PORT}`);
    console.log(`[Server] Audio directory: ${path.resolve(AUDIO_DIR)}`);
  });
}

async function startBot() {
  if (!TOKEN) {
    console.warn('[Warn] No DISCORD_TOKEN set. Create a .env file with your bot token.');
    console.log('[Server] Dashboard available, but bot features disabled until token is configured.');
    return;
  }
  try {
    await bot.start();
  } catch (err) {
    console.error('[Error] Failed to connect Discord bot:', err.message);
    console.log('[Server] Dashboard still available, but voice features won\'t work until bot connects');
  }
}

startServer();
startBot();
