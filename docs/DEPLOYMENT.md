# Installation and deployment

## Requirements

For the recommended Docker installation:

- A Linux server or VM with Docker Engine and Docker Compose v2.
- At least 1 GB of free memory while building; 2 GB is more comfortable.
- Several GB of disk space for the image, build cache, and local data.
- Outbound TCP 443 for Discord and media-server API access.
- Outbound UDP for Discord voice. Avoid a TCP-only VPN.
- A Discord application and bot token.
- Optional reachable Navidrome and/or Audiobookshelf servers.

The image uses Node.js 20 on Debian Bookworm. Its build stage includes Python, Make, and a C++ compiler for the native Discord Opus dependency.

## Create the Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. Open **Bot**, create the bot if necessary, and reset/copy its token.
3. Copy the **Application ID** from **General Information**.
4. Put the token in `DISCORD_TOKEN` and the application ID in `DISCORD_CLIENT_ID`.
5. In the OAuth2 URL Generator, select the `bot` and `applications.commands` scopes.
6. Grant View Channels, Send Messages, Embed Links, Connect, Speak, and Use Voice Activity.

No privileged gateway intents are required. The dashboard creates an invite link from your `DISCORD_CLIENT_ID`. Commands are global, so Discord may take a little time to display new or changed commands.

## Docker Compose

```bash
git clone https://github.com/creativekamrul/discord-radio.git
cd discord-radio
cp .env.example .env
```

Edit `.env`. A minimal Discord-only configuration is:

```dotenv
DISCORD_TOKEN=replace-me
DISCORD_CLIENT_ID=replace-me
DASHBOARD_PASSWORD=replace-with-a-long-random-password
DASHBOARD_PORT=3333
```

Start and inspect the stack:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=100
```

Open `http://SERVER_IP:3333`. Change `DASHBOARD_PORT` if port 3333 is already in use. The application always listens on container port 3000.

## Portainer repository stack

1. Open **Stacks** and choose **Add stack**.
2. Select **Repository**.
3. Repository URL: `https://github.com/creativekamrul/discord-radio.git`.
4. Repository reference: `refs/heads/main`.
5. Compose path: `docker-compose.yml`.
6. Add the variables from `.env.example` in Portainer's environment-variable section.
7. Use persistent absolute host paths, for example:

   ```dotenv
   AUDIO_HOST_PATH=/opt/discord-radio/audio
   DATA_HOST_PATH=/opt/discord-radio/data
   ```

8. Deploy the stack.

Typical Portainer variables:

```dotenv
DISCORD_TOKEN=replace-me
DISCORD_CLIENT_ID=replace-me
DASHBOARD_PASSWORD=replace-me
DASHBOARD_PORT=3333
AUDIO_HOST_PATH=/opt/discord-radio/audio
DATA_HOST_PATH=/opt/discord-radio/data
NAVIDROME_URL=http://192.168.1.20:4533
NAVIDROME_INTERNAL_URL=http://192.168.1.20:4533
NAVIDROME_USER=discord-radio
NAVIDROME_PASSWORD=replace-me
AUDIOBOOKSHELF_URL=http://192.168.1.21:13378
AUDIOBOOKSHELF_INTERNAL_URL=http://192.168.1.21:13378
AUDIOBOOKSHELF_TOKEN=replace-me
```

Leave an unused integration's variables blank. Portainer build failures appear in the deployment notification. Runtime logs are under **Containers → radio-discord-bot → Logs**.

## Media-server addressing

URLs are resolved from inside the container. `localhost` means the bot container, not the Docker host. Use:

- A LAN address such as `http://192.168.1.20:4533`.
- A service name when containers share a Docker network, such as `http://navidrome:4533`.
- A reverse-proxy hostname reachable from the container.

Set each `*_INTERNAL_URL` to the fastest address the bot can use for streaming. It may equal the normal URL. Do not use a hostname that resolves only on your desktop.

## Native installation

Install Node.js 20 or newer and a compiler toolchain, then:

```bash
git clone https://github.com/creativekamrul/discord-radio.git
cd discord-radio
npm ci
cp .env.example .env
npm run build
npm start
```

Production listens on `http://localhost:3000`. For watched development, use `npm run dev`.

## Reverse proxy and HTTPS

The application does not terminate TLS. If it is accessible outside a trusted LAN, place it behind HTTPS.

Minimal Caddy example:

```caddyfile
radio.example.com {
    reverse_proxy 127.0.0.1:3333
}
```

Also set a strong `DASHBOARD_PASSWORD`. Prefer a VPN or private access proxy over direct internet exposure.
