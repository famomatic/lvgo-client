# Custom Media Engine API Documentation

> **Status**: Final Specification (v1.0.0-Custom)
> **Base URL**: `http://{host}:{port}` (No version prefix)
> **Content-Type**: `application/json`

This document serves as the **Single Source of Truth** for the Custom Media Engine API.
All endpoints expect and return JSON unless otherwise stated.

---

## 1. System & Resolution

### 1.1 Server Info
Returns system version, build information, and environment details.

- **GET** `/info`
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

- **GET** `/tracks/resolve?identifier={identifier}`
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

- **GET** `/tracks/decode?encoded={base64}`
- **Response**: `200 OK` (Track Object or 400 Bad Request)

---

## 2. Session & Player

### 2.1 Get Player
Retrieves the current state of a player.

- **GET** `/sessions/{sessionId}/players/{guildId}`
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
```

### 2.2 Update Player (Play / Config)
Updates the player configuration. Sending a `track` object will **Stop** the current track and **Play** the new one immediately (bypassing the queue, but keeping the queue intact).

- **PATCH** `/sessions/{sessionId}/players/{guildId}`
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

- **DELETE** `/sessions/{sessionId}/players/{guildId}`
- **Response**: `204 No Content`

---

## 3. Queue Management (Server-Side)

The queue is a persistent **FIFO List** stored in Redis (`queue:{guildId}`).
Tracks flow: `Queue Head` -> `Player` -> `History`.

### 3.1 Get Queue
Retrieves tracks currently waiting in the queue.

- **GET** `/sessions/{sessionId}/players/{guildId}/queue`
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

- **POST** `/sessions/{sessionId}/players/{guildId}/queue`
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

- **POST** `/sessions/{sessionId}/players/{guildId}/queue/prepend`
- **Body**: `{ "tracks": [ ... ] }`
- **Response**: `200 OK` `{ "added": 1, "queueLength": 15 }`

### 3.4 Move Track
Moves a track from one index to another. Indices are 0-based.

- **POST** `/sessions/{sessionId}/players/{guildId}/queue/move`
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

- **POST** `/sessions/{sessionId}/players/{guildId}/queue/swap`
- **Body**: `{ "indexA": 2, "indexB": 5 }`
- **Response**: `200 OK`

### 3.6 Skip Track
Forces the current track to finish (Triggering `TrackEnd` -> `AutoPlay`).
The next track in the queue (index 0) naturally starts playing.

- **POST** `/sessions/{sessionId}/players/{guildId}/queue/skip`
- **Body**: (Empty)
- **Response**: `204 No Content`

### 3.7 Remove Range
Removes a specific set of tracks from the queue.

- **DELETE** `/sessions/{sessionId}/players/{guildId}/queue`
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

## 4. History Management

The server automatically maintains a history of played tracks in Redis (`history:{guildId}`).
**Behavior**:
1. When a track finishes (`FINISHED` or `STOPPED`), it is pushed to the front of the History List.
2. The list is capped (default 50). Oldest items are dropped.
3. Duplicates are **allowed** (if you play A -> B -> A, history is [A, B, A]).

### 4.1 Get History
View previously played tracks. Index 0 is the most recently finished track.

- **GET** `/sessions/{sessionId}/players/{guildId}/history`
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

- **POST** `/sessions/{sessionId}/players/{guildId}/history/replay`
- **Body**:
```json
{
  "index": 0, // 0 = Replay last played track
  "mode": "play" // ENUM: "play" (immediate), "queue" (end), "next" (front)
}
```
- **Response**: `200 OK` `{ "track": { ... }, "position": "playing" }`

---

## 5. Caching System

### 5.1 Invalidate Cache
Forcibly removes an item from the cache.

- **DELETE** `/cache/{identifier}`
- **Query**: `scope` ("metadata", "content", "all")
- **Response**: `204 No Content`

---

## 6. WebSocket Events

Events are sent to connected WebSocket clients.

- **TrackStart**: `{ "op": "event", "type": "TrackStartEvent", "track": {...} }`
- **TrackEnd**: `{ "op": "event", "type": "TrackEndEvent", "track": {...}, "reason": "FINISHED" }`
    - `reason`: `FINISHED`, `loadFailed`, `STOPPED`, `REPLACED`, `CLEANUP`.
- **QueueUpdate**: `{ "op": "event", "type": "QueueUpdate", "guildId": "...", "size": 10 }` (Optional, useful for UI sync)
- **HistoryUpdate**: `{ "op": "event", "type": "HistoryUpdate", "guildId": "..." }`
