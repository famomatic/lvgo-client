# Custom Media Engine API Documentation

> **Status**: Final Specification (Dual Mode: v4 & g1)
> **Base URL (Custom)**: `http://{host}:{port}/g1`
> **Base URL (Standard)**: `http://{host}:{port}/v4`
> **Content-Type**: `application/json`

This document serves as the **Single Source of Truth** for the Custom Media Engine API.
All endpoints expect and return JSON unless otherwise stated.

---

# Part 1: Custom G1 API (`/g1`)

The following endpoints are available under the `/g1` prefix.

---

## 1. System & Resolution

### 1.1 Server Info
Returns system version, build information, and environment details.

- **GET** `/g1/info`
- **Response**: `200 OK`
```json
{
  "version": "1.0.0-custom",
  "buildTime": 1705649231000,
  "git": { "branch": "main", "commit": "abc1234" },
  "features": {
    "queue": true,
    "history": true,
    "caching": ["metadata", "content"]
  }
}
```

### 1.2 Track Resolution
Resolves a search query or URL into loadable tracks.

- **GET** `/g1/tracks/resolve?identifier={identifier}`
- **Query Parameters**:
  - `identifier` (Required): URL or search query (e.g., `ytsearch:Hello`).
- **Response**: `200 OK`
```json
{
  "type": "TRACK", // ENUM: TRACK, PLAYLIST, SEARCH, EMPTY, ERROR
  "playlistName": null,
  "exception": null,
  "tracks": [
    {
      "encoded": "QAAAjCIA...",
      "info": {
        "identifier": "dQw4w9WgXcQ",
        "isSeekable": true,
        "author": "Rick Astley",
        "length": 212000,
        "isStream": false,
        "position": 0,
        "title": "Never Gonna Give You Up",
        "uri": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "sourceName": "youtube",
        "artworkUrl": "..."
      }
    }
  ]
}
```

### 1.3 Multi-source Search
Searches across multiple sources simultaneously.

- **GET** `/g1/tracks/search?query={query}&sources={sources}`
- **Query Parameters**:
  - `query` (Required): Search term.
  - `sources` (Optional): Comma-separated list (e.g., `youtube,soundcloud`). Default: all.
- **Response**: `200 OK`
```json
{
  "youtube": { "result": { ... }, "latency": 50 },
  "soundcloud": { "result": { ... }, "latency": 120 }
}
```

### 1.4 Track Decoding
Decodes a base64 encoded track string.

- **GET** `/g1/tracks/decode?encoded={base64}`
- **Response**: `200 OK` (Track Object or 400 Bad Request)

---

## 2. Session & Player

### 2.1 Get Player
Retrieves the current state of a player.

- **GET** `/g1/sessions/{sessionId}/players/{guildId}`
- **Response**: `200 OK`
```json
{
  "guildId": "123456789",
  "track": { ... }, // Currently playing track or null
  "volume": 100,
  "paused": false,
  "state": {
    "time": 1705649250000,
    "position": 54000,
    "connected": true,
    "ping": 42
  },
  "voice": { ... },
  "filters": { ... }
}
  "filters": { ... }
}
```

### 2.2 Get Players (List)
Retrieves a list of all players in the session.

- **GET** `/g1/sessions/{sessionId}/players`
- **Response**: `200 OK`
```json
[
  {
    "guildId": "123456789",
    "track": { ... },
    "volume": 100,
    ...
  },
  ...
]
```

### 2.3 Update Player (Play / Config)
Updates the player configuration. Sending a `track` object will **Stop** the current track and **Play** the new one immediately (bypassing the queue, but keeping the queue intact).

- **PATCH** `/g1/sessions/{sessionId}/players/{guildId}`
- **Body**:
```json
{
  "track": { "encoded": "..." }, // Optional: If set, REPLACES current track
  "paused": true,
  "volume": 50,
  "position": 10000,
  "filters": {
    "volume": 1.0,
    "equalizer": [ ... ]
  }
}
```
- **Response**: `200 OK` (Updated Player Object)

### 2.4 Destroy Player
Disconnects voice, deletes the player, **Clears Queue**, and **Clears History**.

- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}`
- **Response**: `204 No Content`

### 2.5 Player Shortcuts (Convenience)
These endpoints provide quick actions without needing full PATCH payloads.

#### Stop Player
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/stop`
- **Response**: `204 No Content`

#### Replay Track
Restarts the current track from the beginning.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/replay`
- **Response**: `200 OK` (Player Object)

#### Seek Track
Seeks to a specific position (in milliseconds).
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/seek`
- **Body**: `{ "position": 60000 }`
- **Response**: `200 OK` (New Position: Int64)

#### Set Repeat Mode
Sets the repeat mode for the player.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/repeat`
- **Body**: `{ "mode": "track" }` // "off", "track", "queue"
- **Response**: `200 OK` (Player Object)

#### Set Auto-Shuffle
Automatically shuffles tracks when added to the queue.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/autoshuffle`
- **Body**: `{ "enabled": true }`
- **Response**: `200 OK`

#### Sleep Timer
Stops the player after a specified duration (in milliseconds).
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/sleep`
- **Body**: `{ "duration": 1800000 }` // 30 minutes = 30 * 60 * 1000 ms
- **Response**: `200 OK`

#### Cancel Sleep Timer
- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/sleep`
- **Response**: `204 No Content`

#### Play Previous Track
Plays the last played track.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/previous`
- **Response**: `200 OK`

#### Get Player Stats
Retrieves playback statistics.
- **GET** `/g1/sessions/{sessionId}/players/{guildId}/stats`
- **Response**: `200 OK`
```json
{
  "TotalPlaytimeMs": 123456,
  "TracksPlayed": 10,
  "TrackSkips": 2,
  "SessionStartTime": 1705649231000
}
```

---

## 3. Audio Filters (DSP)

The `filters` object in the Player Update payload allows for real-time audio processing.

### 3.1 Supported Filters

- **volume**: `float` (0.0 to 5.0). Default 1.0.
- **equalizer**: `Array<float>` (Size 15). Gains for bands [25, 40, 63, 100, 160, 250, 400, 630, 1k, 1.6k, 2.5k, 4k, 6.3k, 10k, 16k] Hz. (-0.25 to 1.0).
- **karaoke**:
  ```json
  { "level": 1.0, "monoLevel": 1.0, "filterBand": 220.0, "filterWidth": 100.0 }
  ```
- **timescale**:
  ```json
  { "speed": 1.0, "pitch": 1.0, "rate": 1.0 }
  ```
- **tremolo**:
  ```json
  { "frequency": 2.0, "depth": 0.5 }
  ```
- **vibrato**:
  ```json
  { "frequency": 2.0, "depth": 0.5 }
  ```
- **rotation**:
  ```json
  { "rotationHz": 0.2 }
  ```
- **distortion**:
  ```json
  { "sinOffset": 0, "sinScale": 1, "cosOffset": 0, "cosScale": 1, "tanOffset": 0, "tanScale": 1, "offset": 0, "scale": 1 }
  ```
- **channelMix**:
  ```json
  { "leftToLeft": 1.0, "leftToRight": 0.0, "rightToLeft": 0.0, "rightToRight": 1.0 }
  ```
- **lowPass**:
  ```json
  { "smoothing": 20.0 }
  ```

### 3.2 Custom Filters (G1 Only)

These filters are **ignored** if sent to the `/v4` endpoint. They only work with the `/g1` API.

- **loudnessNormalization**: `boolean`. Default `false`.
- **silenceRemoval**: `boolean`. Default `false`.
- **seekGhosting**: `boolean`. Default `false`.
- **crossfading**: `boolean`. Default `false`.
- **crossfadeDurationMs**: `int`. Duration in milliseconds (e.g. `5000` for 5s).

---

## 4. Queue Management (Server-Side)

The queue is a persistent **FIFO List** stored in Redis (`queue:{guildId}`).
> **Storage Note**: If Redis is not configured or unavailable, the system automatically falls back to **In-Memory Storage**. In this mode, queues will function normally but will not persist across server restarts.

Tracks flow: `Queue Head` -> `Player` -> `History`.

### 4.1 Get Queue
Retrieves tracks currently waiting in the queue.

- **GET** `/g1/sessions/{sessionId}/players/{guildId}/queue`
- **Query Parameters**:
  - `page` (default 1)
  - `limit` (default 50)
- **Response**: `200 OK`
```json
{
  "total": 12, // Total items in queue
  "page": 1,
  "tracks": [
    { "encoded": "...", "info": { ... } }, // Track 1
    { "encoded": "...", "info": { ... } }  // Track 2
  ]
}
```

### 4.2 Add to Queue
Appends tracks to the **End** of the queue.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue`
- **Body**:
```json
{
  "tracks": [
    { "encoded": "..." },
    { "encoded": "..." }
  ]
}
```
- **Response**: `200 OK`
```json
{ "added": 2, "queueLength": 14 }
```

### 4.3 Prepend to Queue (Play Next)
Adds tracks to the **Start** of the queue. They will be played immediately after the current track finishes.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/prepend`
- **Body**: `{ "tracks": [ ... ] }`
- **Response**: `200 OK` `{ "added": 1, "queueLength": 15 }`

### 4.4 Move Track
Moves a track from one index to another. Indices are 0-based.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/move`
- **Body**:
```json
{
  "from": 10,
  "to": 0 // Move 11th track to the front
}
```
- **Response**: `200 OK`

### 4.5 Swap Tracks
Swaps the positions of two tracks.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/swap`
- **Body**: `{ "indexA": 2, "indexB": 5 }`
- **Response**: `200 OK`

### 4.6 Skip Track
Forces the current track to finish (Triggering `TrackEnd` -> `AutoPlay`).
The next track in the queue (index 0) naturally starts playing.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/skip`
- **Body**: (Empty)
- **Response**: `204 No Content`

### 4.7 Remove Range
Removes a specific set of tracks from the queue by index range.

- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/queue/range`
- **Body**:
```json
{
  "start": 0,
  "end": 1 // Removes items at indices [start, end] (inclusive).
           // Example: start:0, end:0 removes the first item.
}
```
- **Response**: `200 OK` `{ "removed": 1, "remaining": 13 }`

### 4.8 Remove Item by Index
Removes a single item at the specified index.
- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/queue/{index}`
- **Response**: `204 No Content`

---

## 5. History Management

The server automatically maintains a history of played tracks in Redis (`history:{guildId}`).
**Behavior**:
1. When a track finishes (`FINISHED` or `STOPPED`), it is pushed to the front of the History List.
2. The list is capped (default 50). Oldest items are dropped.
3. Duplicates are **allowed** (if you play A -> B -> A, history is [A, B, A]).

### 5.1 Get History
View previously played tracks. Index 0 is the most recently finished track.

- **GET** `/g1/sessions/{sessionId}/players/{guildId}/history`
- **Query**: `page`, `limit`
- **Response**: `200 OK`
```json
{
  "total": 5,
  "tracks": [
    { "encoded": "...", "endTime": 1705649200000 }, // Most recent
    { "encoded": "...", "endTime": 1705649000000 }
  ]
}
```

### 5.2 Replay / Add from History
Convenience endpoint to take a track from history and queue it or play it.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/history/replay`
- **Body**:
```json
{
  "index": 0, // 0 = Replay last played track
  "mode": "play" // ENUM: "play" (immediate), "queue" (end), "next" (front)
}
```
- **Response**: `200 OK` `{ "track": { ... }, "position": "playing" }`

### 5.3 Clear History
Clears the play history for the guild.
- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/history`
- **Response**: `204 No Content`

---

## 6. Caching System

### 6.1 Invalidate Cache
Forcibly removes an item from the cache.

- **DELETE** `/g1/cache/{identifier}`
- **Query**: `scope` ("metadata", "content", "all")
- **Response**: `204 No Content`

---

## 7. Listen Together (Party Mode)

Allows multiple guilds (or sessions) to synchronize playback.
All party actions are under: `/g1/sessions/{sessionId}/players/{guildId}/party`

### 7.1 Create Party
Creates a new party hosted by the current player.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/party/create`
- **Response**: `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "hostGuildId": "123456789012345678",
  "hostSessionId": "a1b2c3d4e5f6g7h8",
  "members": [],
  "syncEnabled": true
}
```

### 7.2 Join Party
Joins an existing party.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/party/join`
- **Body**:
```json
{
  "partyId": "550e8400-e29b-41d4-a716-446655440000"
}
```
- **Response**: `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "hostGuildId": "123456789012345678",
  "hostSessionId": "a1b2c3d4e5f6g7h8",
  "members": [
    {
      "guildId": "987654321098765432",
      "sessionId": "z9y8x7w6v5u4t3s2"
    }
  ],
  "syncEnabled": true
}
```

### 7.3 Leave Party
Leaves the current party. If the host leaves, the party is disbanded.
- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/party`
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/party/leave` *(alias)*
- **Response**: `204 No Content`

### 7.4 Get Party Info
- **GET** `/g1/sessions/{sessionId}/players/{guildId}/party`
- **Response**: `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "hostGuildId": "123456789012345678",
  "hostSessionId": "a1b2c3d4e5f6g7h8",
  "members": [
    {
      "guildId": "987654321098765432",
      "sessionId": "z9y8x7w6v5u4t3s2"
    }
  ],
  "syncEnabled": true
}
```

---

## 8. Admin & Stats

### 8.1 Enhanced Health Check
- **GET** `/g1/health`
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "uptime": 3600000,
  "memory": { "alloc": ..., "sys": ... }
}
```

### 8.2 Rate Limit Info
- **GET** `/g1/info/limits`
- **Response**: `200 OK`
```json
{
  "global": { "limit": 100, "remaining": 99, "reset": 123456789 },
  "perIp": { "limit": 10, "remaining": 10 }
}
```

### 8.3 Guild Usage Stats
- **GET** `/g1/stats/{guildId}`
- **Response**: `200 OK`
```json
{
  "TotalTracksPlayed": 50,
  "TotalPlaytimeMs": 12000000,
  "TopTracks": [ ... ]
}
```

---

# Part 2: Standard Lavalink V4 API (`/v4`)

Strict implementation of the [Lavalink V4 REST API](https://lavalink.dev/api/rest.html).
**Rest Base URL**: `/v4`
**WebSocket**: `/v4/websocket`

> **Note**: These endpoints do **NOT** interact with the G1 Queue or History.

## 9. V4 Endpoints (Standard)

### 9.1 Server Info
- **GET** `/v4/info`
- **Response**: `200 OK`
```json
{
  "version": { "semver": "4.0.0", "major": 4, "minor": 0, "patch": 0, "preRelease": "beta" },
  "buildTime": 1705649231000,
  "git": { "branch": "main", "commit": "abc1234", "commitTime": 1705649231000 },
  "jvm": "Go",
  "lavaplayer": "lavalink-go-custom",
  "sourceManagers": ["youtube", "soundcloud"],
  "filters": ["volume", "equalizer"],
  "plugins": []
}
```

### 9.2 Version
- **GET** `/v4/version`
- **Response**: `200 OK` (text/plain)
```
4.0.0-custom-g1
```

### 9.3 Stats
- **GET** `/v4/stats`
- **Response**: `200 OK`
```json
{
  "players": 1,
  "playingPlayers": 1,
  "uptime": 3600000,
  "memory": {
    "free": 100000,
    "used": 200000,
    "allocated": 300000,
    "reservable": 300000
  },
  "cpu": { "cores": 4, "systemLoad": 0.1, "lavalinkLoad": 0.05 },
  "frameStats": { "sent": 6000, "nulled": 0, "deficit": 0 }
}
```

### 9.4 Load Tracks
- **GET** `/v4/loadtracks?identifier={identifier}`
- **Response**: `200 OK`
```json
{
  "loadType": "track", 
  "data": {
    "encoded": "...",
    "info": {
      "identifier": "...",
      "isSeekable": true,
      "author": "...",
      "length": 120000,
      "isStream": false,
      "position": 0,
      "title": "...",
      "uri": "...",
      "artworkUrl": "...",
      "isrc": null,
      "sourceName": "youtube"
    },
    "pluginInfo": {}
  }
}
```

### 9.5 Decode Track
- **GET** `/v4/decodetrack?encodedTrack={encodedTrack}`
- **Response**: `200 OK`
```json
{
  "identifier": "...",
  "isSeekable": true,
  "author": "...",
  "length": 120000,
  "isStream": false,
  "position": 0,
  "title": "...",
  "uri": "...",
  "artworkUrl": "...",
  "isrc": null,
  "sourceName": "youtube"
}
```

### 9.6 Decode Tracks (Bulk)
- **POST** `/v4/decodetracks`
- **Body**: `["encoded1", "encoded2"]`
- **Response**: `200 OK`
```json
[
  { "identifier": "...", "title": "..." },
  { "identifier": "...", "title": "..." }
]
```

### 9.7 Get Player
- **GET** `/v4/sessions/{sessionId}/players/{guildId}`
- **Response**: `200 OK`
```json
{
  "guildId": "...",
  "track": { "encoded": "...", "info": { ... } },
  "volume": 100,
  "paused": false,
  "state": {
    "time": 1705649250000,
    "position": 54000,
    "connected": true,
    "ping": 42
  },
  "voice": { "token": "...", "endpoint": "...", "sessionId": "..." },
  "filters": {}
}
```

### 9.8 Update Player
- **PATCH** `/v4/sessions/{sessionId}/players/{guildId}`
- **Query**: `noReplace` (bool, optional)
- **Body**:
```json
{
  "encodedTrack": "...", // or "identifier": "..."
  "position": 0,
  "endTime": 0,
  "volume": 100,
  "paused": false,
  "filters": { "volume": 1.0, "equalizer": [] },
  "voice": { "token": "...", "endpoint": "...", "sessionId": "..." }
}
```
- **Response**: `200 OK` (Updated Player Object)

### 9.9 Destroy Player
- **DELETE** `/v4/sessions/{sessionId}/players/{guildId}`
- **Response**: `204 No Content`

### 9.10 Update Session
- **PATCH** `/v4/sessions/{sessionId}`
- **Body**:
```json
{
  "resuming": true,
  "timeout": 60
}
```
- **Response**: `200 OK`
```json
{
  "resuming": true,
  "timeout": 60
}
```

---

## 10. WebSocket Events

Events are sent to connected WebSocket clients within the session. The payload format depends on the connected endpoint.

### 10.1 G1 WebSocket (`/g1/websocket`)
Receives **Enriched Events** where the `track` field is the full **APITrack Object**.
- **TrackStart**: `{ "op": "event", "type": "TrackStartEvent", "track": { "encoded": "...", "info": {...}, "userData": {...} } }`
- **TrackEnd**: `{ "op": "event", "type": "TrackEndEvent", "track": { "encoded": "...", ... } }`

### 10.2 V4 WebSocket (`/v4/websocket`)
Receives **Standard Events** compatible with typical Lavalink clients (Downgraded to TrackInfo).
- **TrackStart**: `{ "op": "event", "type": "TrackStartEvent", "track": { "identifier": "...", "title": "..." } }`
- **TrackEnd**: `{ "op": "event", "type": "TrackEndEvent", "track": { ... } }`

### 10.3 Shared Event Types
- **QueueUpdate** (G1 Only typically): `{ "op": "event", "type": "QueueUpdate", "guildId": "...", "size": 10 }`
- **HistoryUpdate** (G1 Only typically): `{ "op": "event", "type": "HistoryUpdate", "guildId": "..." }`
