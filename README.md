# Red Tetris

Networked multiplayer Tetris, Full Stack JavaScript.
Node.js + socket.io on the server, React (Next.js) on the client.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Then open **`http://<host>:<port>/<room>/<player_name>`**, for example
<http://localhost:3000/redpelicans/Alice>. Reaching that URL is all it takes:
the first player to enter a room creates it and becomes its host, the next ones
join it. The home page is only a convenience that builds the same URL and lists
the open rooms.

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js in dev mode behind the custom socket.io server |
| `npm run build` | Production bundle |
| `npm start` | Production server |
| `npm test` | Unit tests |
| `npm run coverage` | Unit tests + coverage report (fails below the thresholds) |
| `npm run lint` | ESLint |

Environment variables (all optional, nothing is committed - `.env*` is gitignored):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP + socket.io port |
| `HOSTNAME` | `0.0.0.0` | Bind address |
| `MAX_PLAYERS` | `8` | Players per room |
| `SCORES_FILE` | `./.scores.json` | Where the bonus leaderboard is persisted |
| `NEXT_PUBLIC_SOCKET_URL` | window origin | Socket URL when the client is served from elsewhere |

---

## The game

- Field of **10 columns × 20 rows**.
- Every player of a game receives **the same pieces, in the same order, at the
  same coordinates** - the sequence is owned by the room and shared by all its
  players.
- Pieces fall at a **constant speed**. A piece that touches the pile stays
  movable for **one more frame**, which allows last-moment adjustments.
- Clearing `n` lines at once sends **`n - 1` indestructible penalty lines** to
  every opponent. Penalty lines hold a negative value, so they can never be part
  of a complete line and can never be cleared.
- Of an opponent you only ever see their **name** and their **spectrum**: the
  height of each of their columns, updated in real time. The actual content of
  their field never leaves the server.
- A game ends when a **single player is left standing** - that player wins.
  There is no draw and no forced scoring: the score is a bonus.
- Solo play is supported: the round then ends when the lone player tops out.
- Several games run concurrently, one room each.

### Controls

| Key | Action |
| --- | --- |
| ← → | Move the piece horizontally |
| ↑ | Rotate the piece |
| ↓ | Soft drop |
| Space | Hard drop |
| C / Shift | Hold the falling piece (bonus) |

---

## Architecture

```
src/
├── server.js              HTTP + socket.io bootstrap (Next.js serves the SPA)
├── socket/handlers.js     every socket.io event, rooms registry
├── game/                  server-side object model (prototype based)
│   ├── Engine.js          class Player  - one board, one falling piece, one loop
│   ├── Room.js            class Game    - players, piece sequence, round lifecycle
│   ├── Tetromino.js       class Piece   - a tetrimino and its rotations
│   ├── Board.js           class Board   - holds a grid, delegates every rule
│   ├── Scores.js          class Scoreboard - bonus, persisted leaderboard
│   └── pure/              ★ pure functions: all the board and piece logic
│       ├── board.js       grids, collisions, line clears, penalties, spectrum
│       ├── pieces.js      shapes, rotations, spawn positions
│       └── rules.js       scoring, levels, speed, game modes
├── context/               React context holding the single socket connection
├── components/            React view layer (function components + hooks)
│   └── Chat.jsx           bonus: the in-room chat
└── app/                   Next.js routes: `/` and `/[room]/[player]`
```

### Client / server responsibilities

The server is **authoritative**. The client holds no game logic at all.

| | Server | Client |
| --- | --- | --- |
| Boards and pieces | owns every grid and every falling piece | renders what it is sent |
| Game loop | one timer per player, drives the fall | - |
| Collisions, rotations, line clears | decides | - |
| Piece sequence | generates and shares it | - |
| Penalty lines | computes and applies them | - |
| Spectrums | computes and broadcasts them | draws them |
| Rooms, host, start/restart | owns | requests |
| Scores and leaderboard | computes and persists | displays |
| Keyboard | - | captures and forwards |

A tampered client can therefore not cheat: it can only send the five inputs
below, which the server validates against its own state.

### Programming style, as required by the subject

- **Client-side code contains no `this`.** Function components and hooks only.
- **The board and piece logic is written with pure functions** - everything
  under `src/game/pure/`. Those functions never use `this`, never mutate their
  arguments and always return new values, which is what makes them trivially
  testable.
- **The server-side code is object oriented**, with the `Player`, `Piece` and
  `Game` classes the subject asks for. Those classes only hold state and
  delegate every computation to the pure layer.
- **No jQuery, no DOM manipulation, no `<canvas>`, no `<svg>`, no `<table>`.**
  Every layout is flexbox. The notification component is hand-written for that
  reason - mainstream toast libraries ship SVG status icons.
- The client is a **single page application**: one HTML document, the JS
  bundles, then socket.io only.

---

## Network protocol

All events travel on a single socket.io connection. Request/response events use
socket.io **acknowledgements** and always answer
`{ ok: true, ... }` or `{ ok: false, message }`.

### Client → server

| Event | Payload | Ack | Meaning |
| --- | --- | --- | --- |
| `enterRoom` | `{ roomName, username }` | room state | Create the room, or join it |
| `setUsername` | `username` | - | Register a name before entering |
| `start` | `roomName` | `{ ok }` | Host only: start or restart a round |
| `setMode` | `{ roomName, mode }` | `{ ok, mode }` | Host only, between rounds (bonus) |
| `gameInput` | `"MoveLeft" \| "MoveRight" \| "Rotate" \| "MoveDown" \| "HardDrop" \| "Hold"` | - | A player input |
| `leaveRoom` | `roomName` | `{ ok }` | Leave the current room or seat |
| `spectate` | `{ roomName, username }` | room state | Watch a running round (bonus) |
| `chat` | `{ text }` | `{ ok }` | Say something in the room (bonus) |
| `listRooms` | - | `{ ok, rooms }` | Open rooms, for the lobby |
| `leaderboard` | - | `{ ok, entries }` | Persisted best scores (bonus) |

### Server → client

| Event | Payload | Sent to |
| --- | --- | --- |
| `GameUpdate` | `{ grid, spectrum, nextPiece, heldPiece, canHold, score, level, lines, gameOver, running }` | the player it belongs to, only |
| `SpectrumUpdate` | `{ socketId, username, spectrum, score, level, lines, gameOver }` | the whole room |
| `roomUpdate` | `{ name, host, mode, isRunning, players[], spectators[] }` | the whole room |
| `gameStarted` | `{ mode }` | the whole room |
| `Winner` | `{ socketId, username }` | the whole room |
| `allPlayersDone` | `boolean` | the whole room |
| `roomList` | `[{ name, players, spectators, mode, isRunning }]` | everybody |
| `chatMessage` | `{ socketId, username, text, spectator, date }` | the whole room (bonus) |
| `roomClosed` | `{ name }` | the audience of a room whose last player left (bonus) |

`GameUpdate` is the only message carrying a full grid, and it is only ever sent
to the socket that owns that grid.

### Room lifecycle

1. The first player to `enterRoom` creates it and becomes the **host**.
2. Other players join. Names must match `[A-Za-z0-9_-]` (≤ 20 for a room,
   ≤ 30 for a player).
3. The host sends `start`; every player is reset and receives a brand new shared
   piece sequence.
4. **No one can join while a round is running** - a newcomer may only *watch*
   it (bonus) and sit down at the table for the next round.
5. If the host leaves, one of the remaining players is promoted automatically.
6. When a single player is left standing, they win and the round ends. The host
   can start the next one.
7. When the last player leaves, the room is destroyed.

No data persistence is required by the game itself; only the bonus leaderboard
writes to disk.

---

## Tests

```bash
npm run coverage
```

273 unit tests, covering the pure logic, the classes, the socket handlers
(against a real socket.io server), the React components, the pages and the
server bootstrap.

The subject requires at least 70% of statements, functions and lines and 50% of
branches. Those thresholds are enforced in `vitest.config.js`: the command fails
below them.

| | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Required | 70% | 50% | 70% | 70% |
| Actual | **96.6%** | **91.6%** | **96.6%** | **97.6%** |

---

## Bonus

- **Scoring system** - 100/300/500/800 points per 1/2/3/4 lines, multiplied by
  the level, plus soft-drop and hard-drop bonuses. One level every ten lines.
- **Persisted scores** - a JSON-file leaderboard (`Scoreboard`), served to the
  clients and displayed next to the game. Survives a restart.
- **Game modes**, picked by the host between two rounds:
  - *Classic* - the mandatory rules.
  - *Increased gravity* - pieces accelerate as the level rises.
  - *Invisible pieces* - the settled pile is hidden; only the penalty lines,
    the falling piece and its landing preview stay visible. The pile is
    revealed once the game is over.
- **Hold** (`C` / `Shift`) - puts the falling piece aside and brings back the
  one held before, at its spawn position and rotation. As in the original game
  it can only be used once per piece, so it cannot be turned into a stall. The
  slot is greyed out until the next piece re-arms it.
- **Spectator mode** - the subject forbids joining a round already in progress,
  so a newcomer is offered to *watch* it instead: they see every player's
  spectrum and the chat, never a field, and can sit down at the table as soon as
  the round is over. Spectators are deliberately kept out of the roster, so they
  never affect the start conditions nor the "last player standing" rule. When
  the last player leaves, the audience is sent back to the lobby.
- **In-room chat** - players and spectators share one channel; spectators are
  flagged with an eye. Messages are whitespace-collapsed and capped server side
  (200 characters), and the last 60 are kept in the scrollback. Typing in the
  chat never reaches the game inputs.
- **Next-piece preview**, **landing preview** (ghost piece) and a **lobby**
  listing the open rooms, their audience and a *Watch* entrance.
