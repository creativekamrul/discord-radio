# Discord Radio Bot

A self-hosted Discord voice bot with a modern web dashboard, Navidrome music playback, Audiobookshelf books and podcasts, queues, progress synchronization, and interactive Discord controls.

## Highlights

- Play Navidrome songs, albums, and playlists in Discord voice channels.
- Browse Audiobookshelf libraries, books, podcasts, and individual episodes.
- Resume Audiobookshelf content and synchronize listening progress.
- Mark a podcast episode or complete audiobook as finished.
- Report Navidrome now-playing state and scrobbles.
- Control playback from the web dashboard or Discord `/player` panel.
- Manage queues, seeking, volume, shuffle, looping, chapters, and sleep timers.
- Run on Linux, Docker Compose, or Portainer.
- Protect the dashboard API with a password.

Navidrome and Audiobookshelf are optional. Configure either one or both.

## Quick start with Docker Compose

```bash
git clone https://github.com/creativekamrul/discord-radio.git
cd discord-radio
cp .env.example .env
```

Edit `.env`, at minimum setting:

```dotenv
DISCORD_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-application-id
DASHBOARD_PASSWORD=use-a-long-random-password
```

Then build and start:

```bash
docker compose up -d --build
docker compose logs -f --tail=100
```

Open `http://SERVER_IP:3333`, sign in with `DASHBOARD_PASSWORD`, invite the bot, and select a server and voice channel.

## Documentation

- [Installation and deployment](docs/DEPLOYMENT.md)
- [Configuration reference](docs/CONFIGURATION.md)
- [Dashboard and Discord commands](docs/USAGE.md)
- [Updating, backups, and security](docs/OPERATIONS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Supported platforms

The recommended platform is a Linux x86-64 host running Docker Engine and Docker Compose v2. Native development is supported on Windows, macOS, and Linux with Node.js 20 or newer.

Discord voice requires outbound HTTPS and UDP access. The dashboard listens on container port `3000`; the supplied Compose file publishes it as host port `3333`.

## Development

```bash
npm ci
cp .env.example .env
npm run dev
```

- Dashboard: `http://localhost:5173`
- API/production server: `http://localhost:3000`

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the watched Node server and Vite client |
| `npm run dev:bot` | Run only the watched Node/API server |
| `npm run dev:client` | Run only Vite |
| `npm run build` | Build the production dashboard |
| `npm start` | Run the production server from `dist/` |
| `npm run preview` | Build and start production locally |

## Technology

Node.js, Express, React, Vite, discord.js, `@discordjs/voice`, Opus, and FFmpeg.

## License

No license file is currently included. Add a license before redistributing or accepting external contributions.
