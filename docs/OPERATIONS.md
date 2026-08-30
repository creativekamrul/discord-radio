# Operations, updates, backups, and security

## Update Docker Compose

```bash
git pull
docker compose up -d --build
docker compose logs -f --tail=100
```

For a clean image build:

```bash
docker compose --progress=plain build --no-cache
docker compose up -d
```

Run these commands from the directory containing `docker-compose.yml`.

## Update Portainer

Open the stack, pull the latest repository changes, and redeploy with a rebuild. Preserve its environment variables and host-path settings. Data survives when `AUDIO_HOST_PATH` and `DATA_HOST_PATH` use persistent host directories.

## Persistence

Persisted by Compose:

- `/app/audio` through `AUDIO_HOST_PATH`.
- `/app/data` through `DATA_HOST_PATH`.
- Dashboard playlists in `/app/data/playlists.json`.

Stored externally by the integrations:

- Navidrome music, playlists, and scrobbles.
- Audiobookshelf libraries and listening progress.

Not persisted:

- Active queue and player state.
- Voice connections.
- Sleep timers.

## Backup and restore

For a consistent backup:

```bash
docker compose stop
tar -czf discord-radio-backup.tar.gz audio data .env
docker compose start
```

The archive is secret because `.env` contains credentials. You can instead keep `.env` in a password manager and archive only `audio` and `data`.

To restore, clone the repository, restore `.env` and the persistent directories, then run `docker compose up -d --build`.

## Logs

```bash
docker compose logs --tail=200 radio-discord-bot
docker compose logs -f radio-discord-bot
```

In Portainer, runtime logs are under **Containers → radio-discord-bot → Logs**. Build errors appear in the stack deployment notification. To reproduce a build with full output:

```bash
docker compose --progress=plain build --no-cache
```

Normal logs include initialization, dashboard startup, Discord login, command registration, scrobbles, and real warnings/errors. Full Navidrome responses are not logged.

## Security checklist

- Never commit `.env`; Git and Docker ignore it.
- Use a long random `DASHBOARD_PASSWORD`.
- Do not expose port 3333 publicly without HTTPS and access controls.
- Use dedicated non-administrator media-server accounts.
- Restrict Portainer access because stack variables contain secrets.
- Rotate exposed Discord, Navidrome, and Audiobookshelf credentials.
- Disable debug logs during normal use.
- Encrypt backups containing `.env`.

The dashboard password protects API routes but does not replace TLS. Without HTTPS, credentials can be exposed in transit.
