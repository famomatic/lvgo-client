# lvgo-client

A specialized Lavalink client tailored for the Custom Media Engine G1 API, featuring server-side queue management, history tracking, playback synchronization (Listen Together), and advanced audio filters. Built on top of [Shoukaku](https://github.com/Deivu/Shoukaku).

## Features

- **Server-Side Queue**: Queue allows persistence and offloads state management from the bot.
- **History System**: Automatically tracks played songs with replay capabilities.
- **Listen Together (Party Mode)**: Synchronize playback across multiple guilds.
- **Advanced Audio Filters**: Custom G1 filters including loudness normalization, silence removal, crossfading, and more.
- **Player Shortcuts**: Convenience endpoints for stop, replay, seek, previous track, sleep timer, and auto-shuffle.
- **Multi-Source Search**: Search across multiple sources simultaneously.
- **Session Persistence**: Seamless resuming of sessions.
- **Reliability**: Built on the stable Shoukaku wrapper.

## Installation

```bash
npm install https://github.com/famomatic/lvgo-client.git
```

## Quick Start

### Initialization

```javascript
const { LvgoClient, Connectors } = require('lvgo-client');
const { Client } = require('discord.js');

const client = new Client({ intents: ['Guilds', 'GuildVoiceStates'] });
const Nodes = [{
    name: 'Localhost',
    url: 'localhost:2333',
    auth: 'youshallnotpass'
}];

const lvgo = new LvgoClient(new Connectors.DiscordJS(client), Nodes);

lvgo.on('error', (_, error) => console.error(error));
client.login('token');
```

### Joining & Playing (Queue System)

Unlike standard Shoukaku, `lvgo-client` uses a server-side queue. You don't manage the array of tracks yourself.

```javascript
const player = await lvgo.joinVoiceChannel({
    guildId: 'guild_id',
    channelId: 'channel_id',
    shardId: 0
});

// Resolve a track
const node = player.node;
const result = await node.rest.resolve('ytsearch:Never Gonna Give You Up');
if (!result || !result.tracks.length) return;

const track = result.tracks[0];

// Add to Server-Side Queue (This plays immediately if player is idle)
await node.rest.addQueue(player.guildId, [track]);
```

## Queue & History Management

Interacting with the queue and history is done via the REST API on the node.

### Queue Operations

```javascript
// Get current queue
const queue = await player.node.rest.getQueue(player.guildId);
console.log(`Tracks in queue: ${queue.total}`);

// Skip current track
await player.node.rest.skipQueue(player.guildId);

// Move track (example: move track at index 5 to top)
await player.node.rest.moveQueue(player.guildId, 5, 0);

// Swap tracks
await player.node.rest.swapQueue(player.guildId, 2, 5);

// Remove specific tracks by range
await player.node.rest.removeQueue(player.guildId, 0, 1);

// Remove a single track by index
await player.node.rest.removeQueueItem(player.guildId, 3);
```

### History Operations

```javascript
// Get play history
const history = await player.node.rest.getHistory(player.guildId);

// Replay the last played track
await player.node.rest.replayHistory(player.guildId, 0, 'play');

// Clear history
await player.node.rest.clearHistory(player.guildId);
```

## Player Shortcuts

Convenience methods available directly on the Player instance:

```javascript
// Stop the player
await player.stop();

// Replay current track from the beginning
await player.replay();

// Play the previous track (from history)
await player.playPrevious();

// Set repeat mode ('off', 'track', 'queue')
await player.node.rest.setRepeatMode(player.guildId, 'track');

// Auto-shuffle: automatically shuffle tracks when added
await player.setAutoShuffle(true);

// Sleep timer: stop playback after a duration (in milliseconds)
await player.setSleepTimer(30 * 60 * 1000); // 30 minutes

// Cancel sleep timer
await player.cancelSleepTimer();

// Get player statistics
const stats = await player.getStats();
console.log(`Total playtime: ${stats.TotalPlaytimeMs}ms`);
```

## Listen Together (Party Mode)

Synchronize playback across multiple guilds:

```javascript
// Host creates a party
const party = await player.createParty();
console.log(`Party created with ID: ${party.id}`);

// Other players can join with the party ID
const joinedParty = await otherPlayer.joinParty(party.id);

// Get current party info
const partyInfo = await player.getParty();
console.log(`Party has ${partyInfo.members.length + 1} participants`);

// Leave the party (if host leaves, party is disbanded)
await player.leaveParty();
```

## Audio Filters

All standard Lavalink filters plus custom G1 filters:

```javascript
// Standard filters
await player.setEqualizer([{ band: 0, gain: 0.25 }]);
await player.setTimescale({ speed: 1.2, pitch: 1.0 });
await player.setKaraoke({ level: 1.0, monoLevel: 1.0 });

// G1 Custom Filters
await player.setLoudnessNormalization(true);
await player.setSilenceRemoval(true);
await player.setSeekGhosting(true);
await player.setCrossfading(true);
await player.setCrossfadeDuration(5000); // 5 seconds

// Clear all filters
await player.clearFilters();
```

## Multi-Source Search

Search across multiple sources simultaneously:

```javascript
// Search YouTube and SoundCloud at once
const results = await node.rest.multiSearch('Never Gonna Give You Up', ['youtube', 'soundcloud']);

console.log(`YouTube latency: ${results.youtube.latency}ms`);
console.log(`SoundCloud latency: ${results.soundcloud.latency}ms`);
```

## Events

`lvgo-client` emits specialized events for UI updates.

```javascript
// Triggered when queue changes (add, remove, move, etc.)
player.on('queueUpdate', (event) => {
    console.log(`Queue size updated: ${event.size}`);
});

// Triggered when a track finishes and is added to history
player.on('historyUpdate', (event) => {
    console.log('History updated');
});

// Track start/end events
player.on('start', (event) => console.log(`Now playing: ${event.track.info.title}`));
player.on('end', (event) => console.log(`Track ended: ${event.reason}`));
```

## Admin & Monitoring

```javascript
// Health check
const health = await node.rest.healthCheck();
console.log(`Server uptime: ${health.uptime}ms`);

// Rate limit info
const limits = await node.rest.getRateLimits();

// Guild usage statistics
const guildStats = await node.rest.getGuildStats(player.guildId);
```

## Documentation

For full API documentation, refer to the [API_DOCS.md](API_DOCS.md) file included in this repository.

Generated TypeDocs are available in the `docs/` directory after running `npm run build`.