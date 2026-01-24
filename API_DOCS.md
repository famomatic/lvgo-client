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

### 1.3 Track Decoding
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

### 2.2 Update Player (Play / Config)
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

### 2.3 Destroy Player
Disconnects voice, deletes the player, **Clears Queue**, and **Clears History**.

- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}`
- **Response**: `204 No Content`

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

---

## 4. Queue Management (Server-Side)

The queue is a persistent **FIFO List** stored in Redis (`queue:{guildId}`).
Tracks flow: `Queue Head` -> `Player` -> `History`.

### 3.1 Get Queue
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

### 3.2 Add to Queue
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

### 3.3 Prepend to Queue (Play Next)
Adds tracks to the **Start** of the queue. They will be played immediately after the current track finishes.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/prepend`
- **Body**: `{ "tracks": [ ... ] }`
- **Response**: `200 OK` `{ "added": 1, "queueLength": 15 }`

### 3.4 Move Track
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

### 3.5 Swap Tracks
Swaps the positions of two tracks.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/swap`
- **Body**: `{ "indexA": 2, "indexB": 5 }`
- **Response**: `200 OK`

### 3.6 Skip Track
Forces the current track to finish (Triggering `TrackEnd` -> `AutoPlay`).
The next track in the queue (index 0) naturally starts playing.

- **POST** `/g1/sessions/{sessionId}/players/{guildId}/queue/skip`
- **Body**: (Empty)
- **Response**: `204 No Content`

### 3.7 Remove Range
Removes a specific set of tracks from the queue.

- **DELETE** `/g1/sessions/{sessionId}/players/{guildId}/queue`
- **Body**:
```json
{
  "start": 0,
  "end": 1 // Updates to remove [0, 1) or inclusive? Typical list ops are inclusive? 
           // Let's specify: Removes items at indices [start, end].
           // Example: start:0, end:0 removes the first item.
}
```
- **Response**: `200 OK` `{ "removed": 1, "remaining": 13 }`

---

---

## 5. History Management

The server automatically maintains a history of played tracks in Redis (`history:{guildId}`).
**Behavior**:
1. When a track finishes (`FINISHED` or `STOPPED`), it is pushed to the front of the History List.
2. The list is capped (default 50). Oldest items are dropped.
3. Duplicates are **allowed** (if you play A -> B -> A, history is [A, B, A]).

### 4.1 Get History
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

### 4.2 Replay / Add from History
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

---

## 6. Caching System

### 5.1 Invalidate Cache
Forcibly removes an item from the cache.

- **DELETE** `/g1/cache/{identifier}`
- **Query**: `scope` ("metadata", "content", "all")
- **Response**: `204 No Content`

---

# Part 2: Standard Lavalink V4 API (`/v4`)

Strict implementation of the [Lavalink V4 REST API](https://lavalink.dev/api/rest.html).
**Rest Base URL**: `/v4`
**WebSocket**: `/v4/websocket`

> **Note**: These endpoints do **NOT** interact with the G1 Queue or History.

## Supported Endpoints

- **GET** `/v4/info`: Standard V4 Info Response.
- **GET** `/v4/version`: Plain text version string.
- **GET** `/v4/stats`: Server stats.
- **GET** `/v4/loadtracks`: Track Loading.
- **GET** `/v4/decodetrack`: Single track decoding.
- **POST** `/v4/decodetracks`: Bulk track decoding.
- **GET** `/v4/sessions/{sessionId}/players/{guildId}`: Get Player.
- **PATCH** `/v4/sessions/{sessionId}/players/{guildId}`: Update Player (Play/Stop/Filters).
- **DELETE** `/v4/sessions/{sessionId}/players/{guildId}`: Destroy Player.
- **PATCH** `/v4/sessions/{sessionId}`: Update Session.

---

## 7. WebSocket Events

Events are sent to connected WebSocket clients within the session. The payload format depends on the connected endpoint.

### 6.1 G1 WebSocket (`/g1/websocket`)
Receives **Enriched Events** where the `track` field is the full **APITrack Object**.
- **TrackStart**: `{ "op": "event", "type": "TrackStartEvent", "track": { "encoded": "...", "info": {...}, "userData": {...} } }`
- **TrackEnd**: `{ "op": "event", "type": "TrackEndEvent", "track": { "encoded": "...", ... } }`

### 6.2 V4 WebSocket (`/v4/websocket`)
Receives **Standard Events** compatible with typical Lavalink clients (Downgraded to TrackInfo).
- **TrackStart**: `{ "op": "event", "type": "TrackStartEvent", "track": { "identifier": "...", "title": "..." } }`
- **TrackEnd**: `{ "op": "event", "type": "TrackEndEvent", "track": { ... } }`

### 6.3 Shared Event Types
- **QueueUpdate** (G1 Only typically): `{ "op": "event", "type": "QueueUpdate", "guildId": "...", "size": 10 }`
- **HistoryUpdate** (G1 Only typically): `{ "op": "event", "type": "HistoryUpdate", "guildId": "..." }`
