# Custom Media Engine API Documentation

> **Status**: Final Specification (Dual Mode: v4 & g1)
> **Base URL (Custom)**: `http://{host}:{port}/g1`
> **Base URL (Standard)**: `http://{host}:{port}/v4`
> **Content-Type**: `application/json`

This document serves as the **Single Source of Truth** for the Custom Media Engine API.
All endpoints expect and return JSON unless otherwise stated.

---

## Authentication & Security

All endpoints (REST and WebSocket) require authentication via the `Authorization` header containing the server password configured in `application.yml`.

**Security Features:**
- Constant-time password comparison (`crypto/subtle`) prevents timing attacks
- Auth rate limiting: configurable max failed attempts, window, and ban duration per IP
- Global rate limiting: configurable requests per second per IP (applied after auth)
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- Optional guild authorization (`server.guildAuthorization`): when enabled, sessions must first send a voice update before they can manipulate a guild's player

**Error Responses:**
- `401 Unauthorized`: Invalid password
- `429 Too Many Requests`: Rate limit exceeded (includes `retry_after` in seconds for V4)
- `403 Forbidden`: Guild not authorized (when `guildAuthorization` is enabled)

---

# Part 1: Custom G1 API (`/g1`)

The following endpoints are available under the `/g1` prefix.

---

## 1. System & Resolution

### 1.1 Server Info
Returns system version, build information, and registered sources.

- **GET** `/g1/info`
- **Response**: `200 OK`
```json
{
  "version": "1.0.0-custom",
  "buildTime": 1705649231000,
  "lavaplayer": "lavalink-go-custom",
  "sourceManagers": ["youtube", "soundcloud", "spotify", "http", "local"],
  "features": ["queue", "history", "caching"]
}
```

### 1.2 Track Resolution
Resolves a search query or URL into loadable tracks. Results are cached via the metadata cache.

- **GET** `/g1/tracks/resolve?identifier={identifier}`
- **Query Parameters**:
  - `identifier` (Required): URL or search query (e.g., `ytsearch:Hello`).
- **Source Detection**: Auto-detects source from identifier prefix/URL (youtube, soundcloud, spotify, soop, chzzk, http).
- **Response**: `200 OK`
```json
{
  "loadType": "track",
  "data": {
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
    },
    "pluginInfo": {},
    "userData": null
  }
}
```

**Load Types**: `track`, `playlist`, `search`, `empty`, `error`

### 1.3 Multi-source Search
Searches across multiple sources simultaneously with concurrency limits.

- **GET** `/g1/tracks/search?query={query}&sources={sources}`
- **Query Parameters**:
  - `query` (Required): Search term.
  - `sources` (Optional): Comma-separated list (e.g., `youtube,soundcloud`). Default: all enabled sources.
- **Limits**: Max 10 concurrent sources, 5-second timeout per search.
- **Response**: `200 OK`
```json
{
  "youtube": { "result": { "loadType": "search", "data": [...] }, "latency": 50 },
  "soundcloud": { "result": { "loadType": "search", "data": [...] }, "latency": 120 }
}
```
- **Response**: `504 Gateway Timeout` if all searches time out (partial results returned if some succeed).

### 1.4 Track Decoding
Decodes a base64 encoded track string into track info.

- **GET** `/g1/tracks/decode?encoded={base64}`
- **Query Parameters** (any of these work): `encoded`, `track`, `encodedTrack`
- **Response**: `200 OK` (TrackInfo object) or `400 Bad Request`

### 1.5 System Stats
Returns memory, CPU, and uptime statistics.

- **GET** `/g1/stats`
- **Response**: `200 OK`
```json
{
  "uptime": 3600000,
  "memory": {
    "free": 100000,
    "used": 200000,
    "allocated": 300000,
    "reservable": 300000
  },
  "cpu": { "cores": 4 }
}
```

---

## 2. Session & Player

### 2.0 Update Session
Updates session configuration (resuming and timeout).

- **PATCH** `/g1/sessions/{sessionId}`
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

### 2.1 Get Player
Retrieves the current state of a player. Returns `404` if the player does not exist (does not auto-create on GET).

- **GET** `/g1/sessions/{sessionId}/players/{guildId}`
- **Response**: `200 OK`
```json
{
  "guildId": "123456789",
  "track": { "encoded": "...", "info": { ... }, "pluginInfo": {}, "userData": null },
  "volume": 100,
  "paused": false,
  "repeatMode": "off",
  "state": {
    "time": 1705649250000,
    "position": 54000,
    "connected": true,
    "ping": 42
  },
  "voice": {
    "token": "...",
    "endpoint": "...",
    "sessionId": "...",
    "channelId": "123456789012345678"
  },
  "filters": { ... }
}
```

### 2.2 Get Players (List)
Retrieves a list of all players in the session.

- **GET** `/g1/sessions/{sessionId}/players`
- **Response**: `200 OK` — Array of Player objects.

### 2.3 Update Player (Play / Config)
Updates the player configuration. Sending a `track` object will **Stop** the current track and **Play** the new one immediately (bypassing the queue, but keeping the queue intact).

- **PATCH** `/g1/sessions/{sessionId}/players/{guildId}`
- **Query Parameters**:
  - `noReplace` (Optional, boolean): If `true`, the operation will be ignored if a track is already playing. Default `false`.
- **Body**:
```json
{
  "track": {
    "encoded": "...",
    "identifier": "...",
    "userData": {}
  },
  "voice": {
    "token": "...",
    "endpoint": "...",
    "sessionId": "...",
    "channelId": "123456789012345678"
  },
  "paused": true,
  "position": 10000,
  "volume": 50,
  "filters": {
    "volume": 1.0,
    "equalizer": [ ... ]
  }
}
```
- **Response**: `200 OK` (Updated Player Object)

**Track Loading Priority:**
1. If `track.encoded` is set: decodes and plays the encoded track.
2. If `track.identifier` is set: resolves via source managers and plays.
3. If `track` is present but both are empty/null: stops playback.

**Voice update rules:**
- `sessionId`, `token`, `endpoint`, `channelId` are all optional for PATCH.
- Empty/missing fields are treated as "keep current value".
- If `sessionId` changes, server reinitializes the voice connection (fresh DAVE/MLS session).
- For DAVE/E2EE environments, `channelId` should be provided.
- Sending a voice update claims the guild for this session (when `guildAuthorization` is enabled).

**Volume**: Integer 0-1000 (100 = normal). Values outside this range return `400 Bad Request`.

**Party Sync**: If the player is a party host with sync enabled, updates (track, position, filters) are asynchronously propagated to all party members.

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
- **Party Sync**: Position is asynchronously synced to party members.
- **Response**: `200 OK` (Player Object)

#### Set Repeat Mode
Sets the repeat mode for the player.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/repeat`
- **Body**: `{ "mode": "track" }` — `"off"`, `"track"`, `"queue"`. Unknown values default to `"off"`.
- **Response**: `200 OK` (Player Object)

#### Set Auto-Shuffle
Automatically shuffles tracks when added to the queue.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/autoshuffle`
- **Body**: `{ "enabled": true }`
- **Response**: `200 OK`
```json
{ "autoShuffle": true }
```

#### Sleep Timer
Stops the player after a specified duration (in milliseconds).
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/sleep`
- **Body**: `{ "duration": 1800000 }`
- **Validation**: Duration must be between 1 and 86400000 ms (24 hours).
- **Response**: `200 OK`
```json
{ "message": "Sleep timer set" }
```

#### Cancel Sleep Timer
- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/sleep`
- **Response**: `200 OK`
```json
{ "message": "Sleep timer cancelled" }
```

#### Play Previous Track
Plays the last played track from internal history.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/previous`
- **Response**: `200 OK` (Player Object) or `400 Bad Request` if no previous track exists.

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
- **equalizer**: `Array<EqualizerBand>` (Size 15). Bands: [25, 40, 63, 100, 160, 250, 400, 630, 1k, 1.6k, 2.5k, 4k, 6.3k, 10k, 16k] Hz.
  ```json
  [{ "band": 0, "gain": 0.25 }, { "band": 1, "gain": -0.1 }]
  ```
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
- **distortion**: All parameters clamped to [-100, 100] range.
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

- **loudnessNormalization**: `boolean`. Default `false`. Applies EBU R128 loudness normalization.
- **silenceRemoval**: `boolean`. Default `false`. Removes silence from the beginning of tracks.
- **seekGhosting**: `boolean`. Default `false`.
- **crossfading**: `boolean`. Default `false`.
- **crossfadeDurationMs**: `int`. Duration in milliseconds (e.g. `5000` for 5s).

---

## 4. Queue Management (Server-Side)

The queue is a persistent **FIFO List** stored in Redis (`queue:{guildId}`).
> **Storage Note**: If Redis is not configured or unavailable, the system automatically falls back to **In-Memory Storage**. In this mode, queues will function normally but will not persist across server restarts.

Tracks flow: `Queue Head` -> `Player` -> `History`.

**Auto-Play**: When tracks are added to the queue (via Add or Prepend) and the player is idle (no track playing), the server automatically pops and plays the next track.

**Batch Limits**: Add and Prepend endpoints accept a maximum of 500 tracks per request.

### 4.1 Get Queue
Retrieves tracks currently waiting in the queue.

- **GET** `/g1/sessions/{sessionId}/players/{guildId}/queue`
- **Query Parameters**:
  - `page` (default 1, minimum 1)
  - `limit` (default 50, minimum 1, maximum 100)
- **Response**: `200 OK`
```json
{
  "total": 12,
  "page": 1,
  "tracks": [
    { "encoded": "...", "info": { ... } },
    { "encoded": "...", "info": { ... } }
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

### 4.4 Clear Queue
Removes all tracks from the queue.

- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/queue`
- **Response**: `204 No Content`

### 4.5 Move Track
Moves a track from one index to another. Indices are 0-based.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/move`
- **Body**:
```json
{
  "from": 10,
  "to": 0
}
```
- **Response**: `200 OK`

### 4.6 Swap Tracks
Swaps the positions of two tracks.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/swap`
- **Body**: `{ "indexA": 2, "indexB": 5 }`
- **Response**: `200 OK`

### 4.7 Shuffle Queue
Randomly shuffles all tracks in the queue.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/shuffle`
- **Response**: `200 OK`

### 4.8 Skip Track
Forces the current track to finish (triggering `TrackEnd` -> Auto-Play next).

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/skip`
- **Response**: `204 No Content`

### 4.9 Remove Range
Removes a specific set of tracks from the queue by index range (inclusive on both ends).

- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/queue/range`
- **Body**:
```json
{
  "start": 0,
  "end": 1
}
```
- **Response**: `200 OK`
```json
{ "removed": 2 }
```

### 4.10 Remove Item by Index
Removes a single item at the specified index.
- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/queue/{index}`
- **Response**: `204 No Content`

---

## 5. History Management

The server automatically maintains a history of played tracks in Redis (`history:{guildId}`).
**Behavior**:
1. When a track finishes (`finished`, `loadFailed`, `stuck`, or `skipped`), it is pushed to the front of the History List.
2. The list is capped (configurable, default 100). Oldest items are dropped.
3. Duplicates are controlled by configuration (`persistence.history.allowDuplicates`).

### 5.1 Get History
View previously played tracks. Index 0 is the most recently finished track.

- **GET** `/g1/sessions/{sessionId}/players/{guildId}/history`
- **Query Parameters**:
  - `page` (default 1, minimum 1)
  - `limit` (default 50, minimum 1, maximum 100)
- **Response**: `200 OK`
```json
{
  "total": 5,
  "page": 1,
  "tracks": [
    { "encoded": "...", "endTime": 1705649200000 },
    { "encoded": "...", "endTime": 1705649000000 }
  ]
}
```

### 5.2 Replay / Add from History
Takes a track from history and plays or queues it.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/history/replay`
- **Body**:
```json
{
  "index": 0,
  "mode": "play"
}
```
- **Modes**:
  - `"play"` (default): Immediately plays the track.
  - `"queue"`: Adds to the end of the queue.
  - `"next"`: Adds to the front of the queue (prepend).
- **Response**: `200 OK` (Player Object) or `404 Not Found`

### 5.3 Clear History
Clears the play history for the guild.
- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/history`
- **Response**: `204 No Content`

---

## 6. Caching System

### 6.1 Invalidate Cache
Forcibly removes an item from the metadata cache.

- **DELETE** `/g1/cache/{identifier}`
- **Response**: `204 No Content`

---

## 7. Listen Together (Party Mode)

Allows multiple guilds (or sessions) to synchronize playback.
All party actions are under: `/g1/sessions/{sessionId}/players/{guildId}/party`

When a party host's player state changes (track, position, filters), the changes are automatically propagated to all party members.

### 7.1 Create Party
Creates a new party hosted by the current player.
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/party/create`
- **Response**: `200 OK`
```json
{
  "ID": "550e8400-e29b-41d4-a716-446655440000",
  "HostGuildID": "123456789012345678",
  "HostSessionID": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  "Members": [],
  "SyncEnabled": true
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
- **Response**: `200 OK` (Party Object) or `400 Bad Request` / `404 Not Found`

### 7.3 Leave Party
Leaves the current party. If the host leaves, the party is disbanded.
- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/party`
- **POST** `/g1/sessions/{sessionId}/players/{guildId}/party/leave` *(alias)*
- **Response**: `204 No Content`

### 7.4 Get Party Info
- **GET** `/g1/sessions/{sessionId}/players/{guildId}/party`
- **Response**: `200 OK` (Party Object) or `404 Not Found`

---

## 8. Admin & Stats

### 8.1 Enhanced Health Check
- **GET** `/g1/health`
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "uptime": 3600000,
  "memory": {
    "alloc": 12345678,
    "totalAlloc": 23456789,
    "sys": 34567890,
    "numGC": 42
  }
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

> **Note**: These endpoints do **NOT** interact with the G1 Queue or History. Custom filters (loudnessNormalization, silenceRemoval, etc.) are ignored on V4 endpoints.

## 9. V4 Endpoints (Standard)

### 9.1 Server Info
- **GET** `/v4/info`
- **Response**: `200 OK`
```json
{
  "version": { "semver": "4.0.0", "major": 4, "minor": 0, "patch": 0, "preRelease": "beta" },
  "buildTime": 1705649231000,
  "git": { "branch": "main", "commit": "custom", "commitTime": 0 },
  "jvm": "Go / runtime",
  "lavaplayer": "lavalink-go-custom",
  "sourceManagers": ["youtube", "soundcloud"],
  "filters": ["volume", "equalizer", "karaoke", "timescale", "tremolo", "vibrato", "rotation", "distortion", "channelMix", "lowPass"],
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
- **Response**: `200 OK` — Same format as `/g1/stats`.

### 9.4 Load Tracks
- **GET** `/v4/loadtracks?identifier={identifier}`
- **Response**: `200 OK` — Same format as `/g1/tracks/resolve`.

### 9.5 Decode Track
- **GET** `/v4/decodetrack?encodedTrack={encodedTrack}`
- **Query Parameters** (any of these work): `encoded`, `track`, `encodedTrack`
- **Response**: `200 OK` (TrackInfo object)

### 9.6 Decode Tracks (Bulk)
- **POST** `/v4/decodetracks`
- **Body**: `["encoded1", "encoded2"]`
- **Limit**: Max 500 tracks per request.
- **Response**: `200 OK`
```json
[
  { "identifier": "...", "title": "..." },
  { "identifier": "...", "title": "..." }
]
```

### 9.7 Get Player
- **GET** `/v4/sessions/{sessionId}/players/{guildId}`
- **Response**: `200 OK` (Player Object, without `repeatMode` field)

### 9.8 Get Players
- **GET** `/v4/sessions/{sessionId}/players`
- **Response**: `200 OK` — Array of Player objects.

### 9.9 Update Player
- **PATCH** `/v4/sessions/{sessionId}/players/{guildId}`
- **Query**: `noReplace` (bool, optional)
- **Body**:
```json
{
  "track": { "encoded": "..." },
  "position": 0,
  "endTime": 0,
  "volume": 100,
  "paused": false,
  "filters": { "volume": 1.0, "equalizer": [] },
  "voice": { "token": "...", "endpoint": "...", "sessionId": "...", "channelId": "..." }
}
```
- **Response**: `200 OK` (Updated Player Object)

**Voice update rules** — same as G1 (see section 2.3).

### 9.10 Destroy Player
- **DELETE** `/v4/sessions/{sessionId}/players/{guildId}`
- **Response**: `204 No Content`

### 9.11 Update Session
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

### 10.0 WebSocket Connection

**Endpoints**: `/v4/websocket`, `/g1/websocket`

**Required Headers**:
- `Authorization`: Server password (authenticated **before** WebSocket upgrade)
- `User-Id`: Bot user ID (required)

**Optional Headers**:
- `Client-Name`: Client identifier (default: `"Unknown"`)
- `Session-Id`: Existing session ID for reconnection
- `Resume-Key`: Custom resume key for session recovery

**Connection Flow**:
1. Server authenticates via `Authorization` header before WebSocket upgrade.
2. If `Session-Id` or `Resume-Key` provided, attempts to resume existing session.
3. Verifies `User-Id` matches session owner (prevents session hijacking).
4. If no session found, creates a new one.
5. Sends `ready` message:
```json
{ "op": "ready", "resumed": false, "sessionId": "uuid-here" }
```

**Security**: Read limit is 512 KB per message. Resume-Key is redacted in server logs.

### 10.1 G1 WebSocket (`/g1/websocket`)
Receives **Enriched Events** where the `track` field is the full **APITrack Object** (includes `encoded`, `info`, `pluginInfo`, `userData`).
- **TrackStart**: `{ "op": "event", "type": "TrackStartEvent", "guildId": "...", "track": { "encoded": "...", "info": {...}, "pluginInfo": {}, "userData": {...} } }`
- **TrackEnd**: `{ "op": "event", "type": "TrackEndEvent", "guildId": "...", "track": { ... }, "reason": "finished" }`
- **TrackException**: `{ "op": "event", "type": "TrackExceptionEvent", "guildId": "...", "track": { ... }, "exception": { ... } }`
- **TrackStuck**: `{ "op": "event", "type": "TrackStuckEvent", "guildId": "...", "track": { ... }, "thresholdMs": 10000 }`

**TrackEnd Reasons**: `finished`, `stopped`, `loadFailed`, `stuck`, `skipped`

### 10.2 V4 WebSocket (`/v4/websocket`)
Receives **Standard Events** compatible with typical Lavalink clients (track field contains `TrackInfo` only, not full APITrack).
- **TrackStart**: `{ "op": "event", "type": "TrackStartEvent", "guildId": "...", "track": { "identifier": "...", "title": "..." } }`
- **TrackEnd**: `{ "op": "event", "type": "TrackEndEvent", "guildId": "...", "track": { ... }, "reason": "finished" }`
- **TrackException**: `{ "op": "event", "type": "TrackExceptionEvent", "guildId": "...", "track": { ... }, "exception": { ... } }`
- **TrackStuck**: `{ "op": "event", "type": "TrackStuckEvent", "guildId": "...", "track": { ... }, "thresholdMs": 10000 }`

### 10.3 Additional Events
- **PlayerUpdate**: `{ "op": "playerUpdate", "guildId": "...", "state": { "time": ..., "position": ..., "connected": true, "ping": 42 } }` — Sent at configurable intervals (default: every 5 seconds).
- **VolumeChange**: `{ "op": "event", "type": "VolumeChangeEvent", "guildId": "...", "volume": 100 }`
- **FilterChange**: `{ "op": "event", "type": "FilterChangeEvent", "guildId": "...", "filters": { ... } }`
- **SeekEvent**: `{ "op": "event", "type": "SeekEvent", "guildId": "...", "position": 60000 }`
