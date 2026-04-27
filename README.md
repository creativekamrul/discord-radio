# Radio Discord Bot

A Discord bot with a web dashboard for controlling audio playback in voice channels. Upload your music, build playlists, and manage playback from your browser.

## Features

- **Web Dashboard** — control the bot from any browser with a dark, responsive UI
- **Voice Channel Playback** — join any voice channel and stream audio to it
- **Queue Management** — add, remove, reorder, shuffle, and loop tracks
- **File Browser** — upload, browse, and delete audio files (up to 1GB per file)
- **Playlists** — create, edit, and manage saved playlists
- **Seek & Volume** — seek to any point in a track, adjust volume from 0-200%
- **Multi-Guild** — switch between Discord servers from the dashboard
- **Password Protection** — optional dashboard password to restrict access

## Supported Audio Formats

MP3, WAV, OGG, FLAC, M4A, WebM, Opus

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A Discord bot token ([create one here](https://discord.com/developers/applications))

## Setup

1. Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd radio-discord-bot
npm install
```

2. Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your Discord bot token and preferences.

3. Start the development server:

```bash
npm run dev
```

This starts both the Express API server and the Vite dev server with hot-reload.

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both API server and Vite dev server |
| `npm run dev:bot` | Start only the API/bot server |
| `npm run dev:client` | Start only the Vite frontend |
| `npm run build` | Build the frontend for production |
| `npm start` | Start the production server (serves built frontend) |
| `npm run preview` | Build and start production server |

## Inviting the Bot

Your bot needs the following permissions:

- **Connect** — join voice channels
- **Speak** — stream audio
- **Use Voice Activity** — transmit audio

Use the Discord Developer Portal to generate an invite link with these permissions, or construct it manually:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=3146752
```

## Dashboard Usage

1. Enter your dashboard password when prompted
2. Select a Discord server from the dropdown
3. Choose a voice channel and click **Join**
4. Upload audio files or drag-and-drop them into the file browser
5. Click the play button on any file to start playback
6. Use the player controls to pause, skip, seek, adjust volume, toggle loop/shuffle
7. Build playlists from the Playlists tab for quick access

## Project Structure

```
radio-discord-bot/
├── server.js              # Express server entry point
├── vite.config.js         # Vite build config
├── index.html             # Frontend HTML entry
├── audio/                 # Uploaded audio files (gitignored)
├── src/
│   ├── server/
│   │   ├── bot.js         # Discord bot client & voice management
│   │   ├── player.js      # Audio player, queue, ffmpeg streaming
│   │   ├── routes.js      # Express API routes
│   │   └── setup-ffmpeg.js # ffmpeg-static path setup
│   └── client/
│       ├── main.jsx        # React entry point
│       ├── App.jsx         # Main app component
│       ├── App.css         # Global styles
│       ├── api.js          # API client
│       └── components/     # React UI components
└── playlists.json          # Saved playlists (auto-created)
```

## Tech Stack

- **Backend:** Node.js, Express, discord.js, @discordjs/voice, ffmpeg-static
- **Frontend:** React, Vite
- **Audio:** ffmpeg (bundled via ffmpeg-static)
