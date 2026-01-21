# lvgo-client

A specialized Lavalink client tailored for the Custom Media Engine API, featuring server-side queue management, history tracking, and intelligent caching. Built on top of [Shoukaku](https://github.com/Deivu/Shoukaku).

## Features

- **Server-Side Queue**: Queue allows persistence and offloads state management from the bot.
- **History System**: Automatically tracks played songs with replay capabilities.
- **Session Persistence**: Seamless resuming of sessions.
- **Reliability**: Built on the stable Shoukaku wrapper.

## Installation

```bash
npm install https://github.com/famomatic/lvgo-client.git
```

## Quick Start

### Initialization

```javascript
const { Shoukaku, Connectors } = require('lvgo-client');
const { Client } = require('discord.js');

const client = new Client({ intents: ['Guilds', 'GuildVoiceStates'] });
const Nodes = [{
    name: 'Localhost',
    url: 'localhost:2333',
    auth: 'youshallnotpass'
}];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes);

shoukaku.on('error', (_, error) => console.error(error));
client.login('token');
```

### Joining & Playing (Queue System)

Unlike standard Shoukaku, `lvgo-client` uses a server-side queue. You don't manage the array of tracks yourself.

```javascript
const player = await shoukaku.joinVoiceChannel({
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

Interacting with the queue and history is done via the REST API on the node, which has been extended for this client.

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

// Remove specific tracks
await player.node.rest.removeQueue(player.guildId, 0, 1);
```

### History Operations

```javascript
// Get play history
const history = await player.node.rest.getHistory(player.guildId);

// Replay the last played track
await player.node.rest.replayHistory(player.guildId, 0, 'play');
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
```

## Documentation

For full API documentation, refer to the [API_DOCS.md](API_DOCS.md) file included in this repository.