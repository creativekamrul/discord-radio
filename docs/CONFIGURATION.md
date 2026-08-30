# Configuration reference

Configuration comes from environment variables. Native installations can use `.env`; Docker Compose substitutes values from `.env`; Portainer accepts the same keys in the stack environment section.

## Core settings

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | For Discord | none | Secret bot token. |
| `DISCORD_CLIENT_ID` | Recommended | none | Application ID used for the invite link. |
| `DASHBOARD_PASSWORD` | Strongly recommended | no authentication | Password required by dashboard API requests. |
| `PORT` | No | `3000` | Process/container listening port. |
| `DASHBOARD_PORT` | Docker only | `3333` | Host port published by Docker Compose. |
| `AUDIO_DIR` | No | `./audio` | Local audio directory; Compose uses `/app/audio`. |
| `PLAYLISTS_FILE` | No | `./playlists.json` | Playlist JSON path; Compose uses `/app/data/playlists.json`. |

If `DASHBOARD_PASSWORD` is empty, anyone who can reach the dashboard can control the bot. The browser stores the entered password in local storage.

## Docker host paths

| Variable | Default | Description |
| --- | --- | --- |
| `AUDIO_HOST_PATH` | `./audio` | Host directory mounted at `/app/audio`. |
| `DATA_HOST_PATH` | `./data` | Host directory mounted at `/app/data`. |

Use absolute paths in Portainer so backup locations are predictable.

## Navidrome

| Variable | Required | Description |
| --- | --- | --- |
| `NAVIDROME_URL` | For Navidrome | URL used for Subsonic API requests. |
| `NAVIDROME_INTERNAL_URL` | No | URL used for audio/cover streams; defaults to `NAVIDROME_URL`. |
| `NAVIDROME_USER` | For Navidrome | Account username. |
| `NAVIDROME_PASSWORD` | For Navidrome | Account password. |
| `NAVIDROME_DEBUG` | No | `true` enables concise endpoint/status/timing logs. |

Use a dedicated non-administrator user.

```dotenv
NAVIDROME_URL=http://192.168.1.20:4533
NAVIDROME_INTERNAL_URL=http://192.168.1.20:4533
NAVIDROME_USER=discord-radio
NAVIDROME_PASSWORD=replace-me
NAVIDROME_DEBUG=false
```

The bot reports now playing and submits a scrobble after completion or the playback threshold.

## Audiobookshelf

| Variable | Required | Description |
| --- | --- | --- |
| `AUDIOBOOKSHELF_URL` | For Audiobookshelf | Base API URL. |
| `AUDIOBOOKSHELF_INTERNAL_URL` | No | Direct stream URL; defaults to `AUDIOBOOKSHELF_URL`. |
| `AUDIOBOOKSHELF_TOKEN` | For Audiobookshelf | Token for the user whose progress is read and updated. |

Use a dedicated user with access to the desired libraries. Everyone using the bot shares this user's Audiobookshelf history.

```dotenv
AUDIOBOOKSHELF_URL=http://192.168.1.21:13378
AUDIOBOOKSHELF_INTERNAL_URL=http://192.168.1.21:13378
AUDIOBOOKSHELF_TOKEN=replace-me
```

The bot opens playback sessions, synchronizes position, closes sessions, resumes saved positions, and can finish either one podcast episode or one complete book.

## Debug settings

| Variable | Default | Description |
| --- | --- | --- |
| `NAVIDROME_DEBUG` | `false` | Concise Navidrome request timing. |
| `DISCORD_VOICE_DEBUG` | `false` | Verbose Discord voice/network transitions. |

Keep both disabled normally. Voice debug output can be very noisy.

## Complete example

```dotenv
DISCORD_TOKEN=replace-me
DISCORD_CLIENT_ID=replace-me
PORT=3000
DASHBOARD_PORT=3333
DASHBOARD_PASSWORD=replace-with-a-long-random-password
AUDIO_DIR=./audio
PLAYLISTS_FILE=./playlists.json
AUDIO_HOST_PATH=./audio
DATA_HOST_PATH=./data
NAVIDROME_URL=http://192.168.1.20:4533
NAVIDROME_INTERNAL_URL=http://192.168.1.20:4533
NAVIDROME_USER=discord-radio
NAVIDROME_PASSWORD=replace-me
NAVIDROME_DEBUG=false
AUDIOBOOKSHELF_URL=http://192.168.1.21:13378
AUDIOBOOKSHELF_INTERNAL_URL=http://192.168.1.21:13378
AUDIOBOOKSHELF_TOKEN=replace-me
DISCORD_VOICE_DEBUG=false
```
