# Troubleshooting

## Initial checks

```bash
docker compose ps
docker compose logs --tail=200 radio-discord-bot
docker compose config
```

Expected startup messages include the dashboard address, media-server availability, Discord login, and slash-command registration.

## Docker build fails at `npm ci`

The project uses `node:20-bookworm-slim`, sets `WORKDIR /app`, and installs Python, Make, and G++ for `@discordjs/opus`.

```bash
docker compose --progress=plain build --no-cache
```

Check that:

- The Docker endpoint can reach `registry.npmjs.org` and GitHub assets over HTTPS.
- Docker has enough memory and disk space.
- Portainer is building the current `main` branch and Dockerfile.
- A proxy/firewall is not interrupting dependency downloads.
- The Docker endpoint—not only the Portainer UI container—has internet access.

Do not switch to Alpine as a workaround; native Opus is more reliable with the supplied Debian image.

## `no configuration file provided`

Run Compose from the repository directory or specify the file:

```bash
cd /path/to/discord-radio
docker compose --progress=plain build
```

```bash
docker compose -f /path/to/discord-radio/docker-compose.yml --progress=plain build
```

## Dashboard login fails

- Confirm `DASHBOARD_PASSWORD` in the running container.
- Redeploy after changing variables.
- Clear site local storage or log out, then use the new password.
- Ensure a reverse proxy forwards `X-Dashboard-Password`.

## Bot is online but no servers appear

- Ensure `DISCORD_CLIENT_ID` and `DISCORD_TOKEN` belong to the same application.
- Invite with `bot` and `applications.commands` scopes.
- Confirm the bot is a server member.
- Restart after changing the token.

## Slash commands are missing or duplicated

- Look for the global command-registration log.
- Ensure the invite included `applications.commands`.
- Allow time for global commands to refresh.
- Current versions clear old per-server commands at startup to eliminate duplicates.
- Restart Discord if its command picker is stale.

## Bot joins voice but audio is silent

- Grant Connect, Speak, and Use Voice Activity in that channel.
- Allow outbound UDP and TCP 443.
- Test without a host VPN.
- Temporarily set `DISCORD_VOICE_DEBUG=true`, restart, and inspect logs.
- Disable the flag afterward.

## FFmpeg says `Connection reset by peer`

An isolated message during stop, skip, seek, reconnect, or replacement playback is usually harmless because Discord closed the old stream. Repeated messages while audio should continue indicate unstable voice networking, blocked UDP, or repeated reconnects.

## Navidrome is empty or unreachable

- Verify the Navidrome URL, user, and password.
- Remember that container `localhost` is not the host.
- Use a LAN IP, reachable hostname, or shared Docker service name.
- Give the account library and playlist access.
- Temporarily set `NAVIDROME_DEBUG=true` for concise timing logs.

## Navidrome tracking is not updating

- Play long enough to cross the scrobble threshold or let the track finish.
- Check for `Scrobbled` or `Scrobble failed` logs.
- Confirm the user allows scrobbling.

## Audiobookshelf is unavailable

- Verify its URL and token.
- Ensure the token user can access the intended libraries.
- Ensure the container can reach both normal and internal URLs.

## Finished filter shows zero

- Restart/redeploy the Node server after an update. Vite can hot-reload a new UI while an old backend remains active.
- Confirm the token belongs to the user whose history you expect.
- Reopen the item to refresh completion data.
- Read the dashboard's progress-update error if one appears.

## Mark finished does not work

- Confirm playback is from Audiobookshelf.
- Podcast playback must include an episode ID; books update the whole item.
- Confirm the token can update progress.
- Look for a dashboard error or `[Bot] Interaction error` in logs.
- Restart after backend changes.

## Portainer cannot reach a media server

Test from a temporary container:

```bash
docker run --rm curlimages/curl:latest -I http://192.168.1.20:4533
```

For another container, attach both stacks to a shared external network and use Docker DNS.

## Debug logs

Enable only the subsystem being investigated:

```dotenv
NAVIDROME_DEBUG=true
DISCORD_VOICE_DEBUG=false
```

Redeploy after changing flags. Before posting logs, check them for private server addresses, usernames, item titles, and metadata.
