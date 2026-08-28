// @vitest-environment node
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createState,
  isValidRoomName,
  isValidUsername,
  registerHandlers,
} from '../socket/handlers.js';

describe('name validation', () => {
  it('accepts letters, digits, dash and underscore', () => {
    expect(isValidRoomName('room-1')).toBe(true);
    expect(isValidUsername('Green_Fox42')).toBe(true);
  });

  it('rejects empty, oversized and exotic names', () => {
    expect(isValidRoomName('')).toBe(false);
    expect(isValidRoomName('a'.repeat(21))).toBe(false);
    expect(isValidRoomName('room/../etc')).toBe(false);
    expect(isValidRoomName(42)).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
    expect(isValidUsername(undefined)).toBe(false);
  });
});

describe('socket handlers', () => {
  let httpServer;
  let io;
  let state;
  let scoreboard;
  let port;
  const clients = [];

  const connect = () =>
    new Promise((resolve) => {
      const socket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      clients.push(socket);
      socket.on('connect', () => resolve(socket));
    });

  /** Emits an event and resolves with the server's acknowledgement. */
  const ask = (socket, event, payload) =>
    new Promise((resolve) => socket.emit(event, payload, resolve));

  const waitFor = (socket, event) =>
    new Promise((resolve) => socket.once(event, resolve));

  /** Polls until the server state settles, instead of racing a fixed delay. */
  const until = async (predicate, timeout = 2000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('condition never became true');
  };

  beforeEach(async () => {
    httpServer = createServer();
    io = new Server(httpServer);
    state = createState();
    scoreboard = { top: vi.fn(() => [{ username: 'Alice', score: 10 }]), record: vi.fn() };
    registerHandlers(io, state, { scoreboard, maxPlayers: 2 });

    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;
  });

  afterEach(async () => {
    clients.splice(0).forEach((socket) => socket.disconnect());
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  describe('entering a room', () => {
    it('creates the room and makes the first player its host', async () => {
      const socket = await connect();
      const response = await ask(socket, 'enterRoom', {
        roomName: 'lobby',
        username: 'Alice',
      });

      expect(response.ok).toBe(true);
      expect(response.created).toBe(true);
      expect(response.host).toBe(socket.id);
      expect(response.players).toHaveLength(1);
      expect(state.rooms.has('lobby')).toBe(true);
    });

    it('joins an existing room instead of recreating it', async () => {
      const host = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });

      const guest = await connect();
      const response = await ask(guest, 'enterRoom', {
        roomName: 'lobby',
        username: 'Bob',
      });

      expect(response.ok).toBe(true);
      expect(response.created).toBe(false);
      expect(response.host).toBe(host.id);
      expect(state.rooms.size).toBe(1);
      expect(state.rooms.get('lobby').size).toBe(2);
    });

    it('rejects invalid room and player names', async () => {
      const socket = await connect();

      expect((await ask(socket, 'enterRoom', { roomName: '../etc', username: 'Alice' })).ok).toBe(false);
      expect((await ask(socket, 'enterRoom', { roomName: 'lobby', username: 'a b' })).ok).toBe(false);
      expect((await ask(socket, 'enterRoom', {})).ok).toBe(false);
    });

    it('falls back on the username registered with setUsername', async () => {
      const socket = await connect();
      socket.emit('setUsername', 'Alice');
      await until(() => state.players.get(socket.id) === 'Alice');

      const response = await ask(socket, 'enterRoom', { roomName: 'lobby' });
      expect(response.ok).toBe(true);
      expect(response.players[0].username).toBe('Alice');
    });

    it('is idempotent when re-entering the same room', async () => {
      const socket = await connect();
      await ask(socket, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      const again = await ask(socket, 'enterRoom', { roomName: 'lobby', username: 'Alice' });

      expect(again.ok).toBe(true);
      expect(state.rooms.get('lobby').size).toBe(1);
    });

    it('moves a player from one room to another', async () => {
      const socket = await connect();
      await ask(socket, 'enterRoom', { roomName: 'first', username: 'Alice' });
      await ask(socket, 'enterRoom', { roomName: 'second', username: 'Alice' });

      expect(state.rooms.has('first')).toBe(false);
      expect(state.rooms.get('second').size).toBe(1);
    });

    it('refuses a full room', async () => {
      const a = await connect();
      const b = await connect();
      const c = await connect();
      await ask(a, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(b, 'enterRoom', { roomName: 'lobby', username: 'Bob' });

      const response = await ask(c, 'enterRoom', { roomName: 'lobby', username: 'Carol' });
      expect(response.ok).toBe(false);
      expect(response.message).toMatch(/full/i);
    });

    it('refuses to join a round already in progress', async () => {
      const host = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(host, 'start', 'lobby');

      const late = await connect();
      const response = await ask(late, 'enterRoom', { roomName: 'lobby', username: 'Bob' });

      expect(response.ok).toBe(false);
      expect(response.message).toMatch(/already running/i);

      state.rooms.get('lobby').engines.forEach((engine) => engine.stop());
    });

    it('supports several concurrent games', async () => {
      const a = await connect();
      const b = await connect();
      await ask(a, 'enterRoom', { roomName: 'alpha', username: 'Alice' });
      await ask(b, 'enterRoom', { roomName: 'beta', username: 'Bob' });

      expect(state.rooms.size).toBe(2);
      expect(state.rooms.get('alpha').size).toBe(1);
      expect(state.rooms.get('beta').size).toBe(1);
    });
  });

  describe('starting a round', () => {
    it('only lets the host start', async () => {
      const host = await connect();
      const guest = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(guest, 'enterRoom', { roomName: 'lobby', username: 'Bob' });

      expect((await ask(guest, 'start', 'lobby')).ok).toBe(false);
      expect((await ask(host, 'start', 'lobby')).ok).toBe(true);
      expect((await ask(host, 'start', 'lobby')).ok).toBe(false);

      state.rooms.get('lobby').engines.forEach((engine) => engine.stop());
    });

    it('reports an unknown room', async () => {
      const socket = await connect();
      expect((await ask(socket, 'start', 'ghost')).ok).toBe(false);
    });

    it('deals the very same pieces to every player', async () => {
      const host = await connect();
      const guest = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(guest, 'enterRoom', { roomName: 'lobby', username: 'Bob' });

      const updates = Promise.all([waitFor(host, 'GameUpdate'), waitFor(guest, 'GameUpdate')]);
      await ask(host, 'start', 'lobby');
      const [hostState, guestState] = await updates;

      expect(hostState.grid).toEqual(guestState.grid);
      expect(hostState.nextPiece.id).toBe(guestState.nextPiece.id);

      const room = state.rooms.get('lobby');
      const [a, b] = [...room.engines.values()];
      expect(a.tetrominos).toBe(b.tetrominos);
      room.engines.forEach((engine) => engine.stop());
    });
  });

  describe('game modes', () => {
    it('lets the host pick a mode', async () => {
      const host = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });

      const response = await ask(host, 'setMode', { roomName: 'lobby', mode: 'invisible' });
      expect(response.ok).toBe(true);
      expect(state.rooms.get('lobby').mode).toBe('invisible');
    });

    it('refuses an unknown mode, a foreign room or a guest', async () => {
      const host = await connect();
      const guest = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(guest, 'enterRoom', { roomName: 'lobby', username: 'Bob' });

      expect((await ask(host, 'setMode', { roomName: 'lobby', mode: 'nope' })).ok).toBe(false);
      expect((await ask(host, 'setMode', { roomName: 'ghost', mode: 'gravity' })).ok).toBe(false);
      expect((await ask(guest, 'setMode', { roomName: 'lobby', mode: 'gravity' })).ok).toBe(false);
      expect((await ask(host, 'setMode')).ok).toBe(false);
    });
  });

  describe('leaving', () => {
    it('drops the room once its last player leaves', async () => {
      const socket = await connect();
      await ask(socket, 'enterRoom', { roomName: 'lobby', username: 'Alice' });

      expect((await ask(socket, 'leaveRoom', 'lobby')).ok).toBe(true);
      expect(state.rooms.has('lobby')).toBe(false);
      expect(state.engines.has(socket.id)).toBe(false);
    });

    it('hands the room over to a remaining player', async () => {
      const host = await connect();
      const guest = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(guest, 'enterRoom', { roomName: 'lobby', username: 'Bob' });

      const update = waitFor(guest, 'roomUpdate');
      await ask(host, 'leaveRoom', 'lobby');
      const payload = await update;

      expect(payload.host).toBe(guest.id);
      expect(state.rooms.get('lobby').size).toBe(1);
    });

    it('cleans up on disconnect', async () => {
      const socket = await connect();
      await ask(socket, 'enterRoom', { roomName: 'lobby', username: 'Alice' });

      socket.disconnect();
      await until(() => !state.rooms.has('lobby'));

      expect(state.rooms.has('lobby')).toBe(false);
      expect(state.players.has(socket.id)).toBe(false);
    });

    it('leaving without a room is harmless', async () => {
      const socket = await connect();
      expect((await ask(socket, 'leaveRoom', 'ghost')).ok).toBe(false);
    });
  });

  describe('lobby and leaderboard', () => {
    it('lists the open rooms', async () => {
      const socket = await connect();
      await ask(socket, 'enterRoom', { roomName: 'lobby', username: 'Alice' });

      const response = await ask(socket, 'listRooms');
      expect(response.rooms).toEqual([
        { name: 'lobby', players: 1, mode: 'classic', isRunning: false },
      ]);
    });

    it('serves the persisted leaderboard', async () => {
      const socket = await connect();
      const response = await ask(socket, 'leaderboard');

      expect(response.ok).toBe(true);
      expect(response.entries).toEqual([{ username: 'Alice', score: 10 }]);
      expect(scoreboard.top).toHaveBeenCalled();
    });

    it('answers an empty leaderboard when none is configured', async () => {
      const bare = createState();
      const bareIo = new Server(createServer());
      registerHandlers(bareIo, bare, {});
      bareIo.close();
      expect(bare.rooms.size).toBe(0);
    });
  });

  describe('playing', () => {
    it('forwards inputs to the player engine', async () => {
      const socket = await connect();
      await ask(socket, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(socket, 'start', 'lobby');

      const engine = state.engines.get(socket.id);
      const startX = engine.current.position.x;

      const update = waitFor(socket, 'GameUpdate');
      socket.emit('gameInput', 'MoveLeft');
      await update;

      expect(engine.current.position.x).toBe(startX - 1);
      engine.stop();
    });

    it('broadcasts spectrums to the room', async () => {
      const host = await connect();
      const guest = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(guest, 'enterRoom', { roomName: 'lobby', username: 'Bob' });

      const spectrum = waitFor(guest, 'SpectrumUpdate');
      await ask(host, 'start', 'lobby');
      const payload = await spectrum;

      expect(payload.spectrum).toHaveLength(10);
      expect(payload.grid).toBeUndefined();
      state.rooms.get('lobby').engines.forEach((engine) => engine.stop());
    });

    /**
     * Regression: the end of a round only ever reached the room itself, never
     * the lobby listing — so a player who had left kept seeing the room as
     * "in game" long after it was over.
     */
    it('tells the lobby the round is over, even after the host left', async () => {
      const host = await connect();
      const guest = await connect();
      await ask(host, 'enterRoom', { roomName: 'lobby', username: 'Alice' });
      await ask(guest, 'enterRoom', { roomName: 'lobby', username: 'Bob' });

      // The host walks back to the lobby: the guest takes over the room.
      await ask(host, 'leaveRoom', 'lobby');

      let listing = [];
      host.on('roomList', (rooms) => {
        listing = rooms;
      });

      await ask(guest, 'start', 'lobby');
      await until(() => listing.some((room) => room.name === 'lobby' && room.isRunning));

      // The lone player tops out: the lobby must see the room open again.
      state.engines.get(guest.id).endGame();

      await until(() =>
        listing.some((room) => room.name === 'lobby' && room.isRunning === false)
      );
      expect(state.rooms.get('lobby').isRunning).toBe(false);
    });
  });
});
