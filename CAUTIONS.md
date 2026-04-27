# Cautions & Known Issues

## VPN / Proxy Issues

Discord voice uses **UDP** for audio transmission. If you are running the bot behind a VPN or proxy:

- **UDP traffic may be blocked or misrouted**, causing the bot to connect to a voice channel but produce no audio.
- Some VPNs force all traffic through a tunnel that doesn't support UDP, which will break voice playback entirely.
- If the bot shows as connected but no audio plays, try **disabling your VPN** first.

## Firewall

Ensure the following are allowed through your firewall:

- **Outbound UDP** on ports 50000-65535 (Discord voice)
- **Outbound TCP** on port 443 (Discord API gateway)

## DNS Issues

The bot forces IPv4-first DNS resolution (`ipv4first`). If your network has IPv6 issues, this is handled automatically. If you still experience connection problems, check your DNS settings.

## Audio Latency

- **Seeking** creates a new ffmpeg process, which has a brief delay (~0.5-1s).
- **Large files** (especially FLAC) take slightly longer to start playback due to format probing. MP3/Opus start faster.

## File Uploads

- Maximum upload size is **1GB per file**.
- Uploaded files are stored in the `audio/` directory. Make sure you have enough disk space.
- File uploads go through the Express server, so very large uploads may need increased timeout if you're on a slow connection.

## Dashboard Password

- If `DASHBOARD_PASSWORD` is not set in your `.env`, the dashboard has **no authentication** — anyone with the URL can control the bot.
- The password is stored in `localStorage` in the browser. Clearing browser data will require re-entering it.
