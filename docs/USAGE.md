# Using the bot

## First connection

1. Open the dashboard and enter `DASHBOARD_PASSWORD`.
2. If needed, invite the bot with the generated link.
3. Click **Server & voice**.
4. Select a Discord server and voice channel.
5. Join the channel.
6. Open **Music** for Navidrome or **Books & Podcasts** for Audiobookshelf.

For Discord media-selection commands, the user must already be in a voice channel. The bot joins that channel automatically when needed.

## Dashboard

### Player and queue

The player shows the current item, source, collection context, time, duration, percentage, and Audiobookshelf chapter information when available. Controls include play/pause, previous, next, stop, seeking, volume, shuffle, single-item loop, and queue loop.

Audiobookshelf playback adds a context-aware **Mark episode finished** or **Mark book finished** action. The queue is held in memory and is cleared by an application restart.

### Navidrome

The Music view supports:

- Browsing artists and albums.
- Searching artists, albums, and songs.
- Browsing Navidrome playlists.
- Immediate playback or queueing.
- Now-playing reporting and scrobbling.

A normal stop is scrobbled only after enough of the song has played; naturally completed tracks are reported as completed.

### Audiobookshelf

The Books & Podcasts view supports:

- Selecting and searching libraries.
- Opening podcasts and choosing individual episodes.
- Browsing audiobook chapters.
- A separate Continue Listening tab with percentages.
- Filtering episodes by All, Unfinished, and Finished.
- Resuming from the Audiobookshelf user's saved position.
- Finishing one podcast episode or one complete audiobook.

Completion state belongs to the account associated with `AUDIOBOOKSHELF_TOKEN`.

## Discord commands

| Command | Description |
| --- | --- |
| `/join` | Join your current voice channel. |
| `/leave` | Leave the voice channel. |
| `/pause` | Pause playback. |
| `/play` | Resume playback. |
| `/next` | Skip to the next item. |
| `/player` | Open the interactive player panel. |
| `/search query:<text>` | Search Navidrome and select a song. |
| `/see-playlists` | List and select Navidrome playlists. |
| `/play-playlist id:<id>` | Play a Navidrome playlist by ID. |
| `/books` | Select an Audiobookshelf library, item, and episode. |
| `/book-search query:<text>` | Search accessible Audiobookshelf libraries. |

## Discord `/player`

The panel includes play/pause, previous, next, stop, refresh, ±30-second seeking, volume, shuffle, loop, queue clearing, sleep timers, Audiobookshelf chapter navigation, and mark-finished controls.

If an old panel can no longer be edited, run `/player` again.

## Command registration

Commands are registered globally. On startup, the bot clears obsolete per-server registrations to avoid duplicate commands. After a command change, allow Discord time to refresh and restart the Discord client if its command picker is stale.
