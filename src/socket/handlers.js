import { Player } from '../game/Engine.js';
import { Game, listOpenRooms, roomExists } from '../game/Room.js';

export const MAX_PLAYERS = Number.parseInt(process.env.MAX_PLAYERS, 10) || 8;

export const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,20}$/;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,30}$/;

export const isValidRoomName = (name) =>
  typeof name === 'string' && ROOM_NAME_PATTERN.test(name);

export const isValidUsername = (name) =>
  typeof name === 'string' && USERNAME_PATTERN.test(name);

/** Answers an acknowledgement callback, if the client provided one. */
const reply = (ack, payload) => {
  if (typeof ack === 'function') ack(payload);
  return payload;
};

export const createState = () => ({
  rooms: new Map(),
  players: new Map(),
  engines: new Map(),
});

/**
 * Wires every socket.io event of the game.
 *
 * Responsibilities of the server (see README): it owns the boards, the piece
 * sequence, the rooms and the game loop. Clients only send inputs and render
 * what they receive.
 */
export const registerHandlers = (io, state, options = {}) => {
  const scoreboard = options.scoreboard || null;
  const maxPlayers = options.maxPlayers || MAX_PLAYERS;

  const disposeRoom = (room) => {
    state.rooms.delete(room.name);
  };

  const broadcastRooms = () => {
    io.emit('roomList', listOpenRooms(state.rooms));
  };

  /** Detaches a socket from whatever room it was in. */
  const leaveCurrentRoom = (socket) => {
    const engine = state.engines.get(socket.id);
    if (!engine) return false;
    state.engines.delete(socket.id);
    engine.disconnect();
    broadcastRooms();
    return true;
  };

  io.on('connection', (socket) => {
    socket.on('setUsername', (username) => {
      if (isValidUsername(username)) state.players.set(socket.id, username);
    });

    /**
     * Create-or-join. This is what makes a bare
     * `http://<host>:<port>/<room>/<player_name>` URL work: the first player to
     * reach a room creates it and becomes its host, the next ones join it.
     */
    socket.on('enterRoom', (data, ack) => {
      const payload = data || {};
      const roomName = payload.roomName;
      const username = payload.username || state.players.get(socket.id);

      if (!isValidRoomName(roomName)) {
        return reply(ack, {
          ok: false,
          message: 'Room names may only contain letters, digits, - and _ (max 20).',
        });
      }
      if (!isValidUsername(username)) {
        return reply(ack, {
          ok: false,
          message: 'Player names may only contain letters, digits, - and _ (max 30).',
        });
      }

      // Re-entering the room we are already in is a no-op.
      const known = state.engines.get(socket.id);
      if (known && known.room && known.room.name === roomName) {
        return reply(ack, { ok: true, ...known.room.serializePlayers() });
      }
      if (known) leaveCurrentRoom(socket);

      state.players.set(socket.id, username);

      const existing = roomExists(state.rooms, roomName)
        ? state.rooms.get(roomName)
        : null;

      if (existing && existing.isRunning) {
        return reply(ack, {
          ok: false,
          message: 'A game is already running in this room, please wait for the next round.',
        });
      }
      if (existing && existing.engines.size >= maxPlayers) {
        return reply(ack, { ok: false, message: 'This room is full.' });
      }

      const room =
        existing ||
        new Game(roomName, socket.id, io, {
          scoreboard,
          onEmpty: disposeRoom,
          onUpdate: broadcastRooms,
        });
      if (!existing) state.rooms.set(roomName, room);

      const engine = new Player(socket, room.host === socket.id, room.tetrominos);
      engine.username = username;
      state.engines.set(socket.id, engine);

      socket.join(roomName);
      room.addPlayer(engine);
      broadcastRooms();

      return reply(ack, { ok: true, created: !existing, ...room.serializePlayers() });
    });

    socket.on('leaveRoom', (_roomName, ack) => {
      const left = leaveCurrentRoom(socket);
      return reply(ack, { ok: left });
    });

    /** Only the host may start or restart a round. */
    socket.on('start', (roomName, ack) => {
      const room = state.rooms.get(roomName);
      if (!room) return reply(ack, { ok: false, message: 'Room not found.' });
      if (room.host !== socket.id) {
        return reply(ack, { ok: false, message: 'Only the host can start the game.' });
      }
      if (room.isRunning) {
        return reply(ack, { ok: false, message: 'A game is already running.' });
      }

      room.startGames();
      broadcastRooms();
      return reply(ack, { ok: true });
    });

    /** Bonus: the host picks the game mode between two rounds. */
    socket.on('setMode', (data, ack) => {
      const payload = data || {};
      const room = state.rooms.get(payload.roomName);
      if (!room) return reply(ack, { ok: false, message: 'Room not found.' });
      if (room.host !== socket.id) {
        return reply(ack, { ok: false, message: 'Only the host can change the mode.' });
      }
      if (!room.setMode(payload.mode)) {
        return reply(ack, { ok: false, message: 'Cannot change the mode right now.' });
      }

      broadcastRooms();
      return reply(ack, { ok: true, mode: room.mode });
    });

    socket.on('listRooms', (_data, ack) =>
      reply(ack, { ok: true, rooms: listOpenRooms(state.rooms) })
    );

    /** Bonus: the persisted leaderboard. */
    socket.on('leaderboard', (_data, ack) =>
      reply(ack, { ok: true, entries: scoreboard ? scoreboard.top(10) : [] })
    );

    socket.on('disconnect', () => {
      state.players.delete(socket.id);
      leaveCurrentRoom(socket);
    });

    socket.emit('roomList', listOpenRooms(state.rooms));
  });

  return state;
};
