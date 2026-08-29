import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game, listOpenRooms, roomExists } from '../game/Room.js';
import { GRAVITY, INVISIBLE } from '../game/pure/rules.js';

const makeIo = () => {
  const emit = vi.fn();
  return { emit, to: vi.fn(() => ({ emit })), roomEmit: emit };
};

/** Stand-in for a `Player`, with only what `Game` actually touches. */
const makeEngine = (socketId, username = socketId) => ({
  socketId,
  username,
  isHost: false,
  isRunning: false,
  gameOver: false,
  score: 0,
  level: 1,
  clearedLines: 0,
  tetrominos: [],
  room: null,
  board: { spectrum: () => Array(10).fill(0) },
  reset: vi.fn(),
  stop: vi.fn(function stop() {
    this.isRunning = false;
  }),
  start: vi.fn(function start() {
    this.isRunning = true;
  }),
  sendGameState: vi.fn(),
  sendSpectrum: vi.fn(),
});

describe('Game', () => {
  let io;
  let game;

  beforeEach(() => {
    io = makeIo();
    game = new Game('lobby', 'host-1', io);
  });

  it('opens with a host, no players and a shared piece sequence', () => {
    expect(game.name).toBe('lobby');
    expect(game.host).toBe('host-1');
    expect(game.size).toBe(0);
    expect(game.isRunning).toBe(false);
    expect(game.mode).toBe('classic');
    expect(game.tetrominos).toHaveLength(2);
  });

  it('rejects an unknown mode at construction', () => {
    expect(new Game('r', 'h', io, { mode: 'nope' }).mode).toBe('classic');
    expect(new Game('r', 'h', io, { mode: GRAVITY }).mode).toBe(GRAVITY);
  });

  it('hands every player the same piece sequence', () => {
    const a = makeEngine('host-1');
    const b = makeEngine('p2');
    game.addPlayer(a);
    game.addPlayer(b);

    expect(a.tetrominos).toBe(game.tetrominos);
    expect(b.tetrominos).toBe(game.tetrominos);
    expect(a.isHost).toBe(true);
    expect(b.isHost).toBe(false);
  });

  it('serialises spectrums, never the actual grids', () => {
    game.addPlayer(makeEngine('host-1', 'Alice'));
    const payload = game.serializePlayers();

    expect(payload.host).toBe('host-1');
    expect(payload.mode).toBe('classic');
    expect(payload.players[0].username).toBe('Alice');
    expect(payload.players[0].spectrum).toHaveLength(10);
    expect(payload.players[0].grid).toBeUndefined();
  });

  describe('host hand-over', () => {
    it('promotes a remaining player when the host leaves', () => {
      const host = makeEngine('host-1');
      const second = makeEngine('p2');
      const third = makeEngine('p3');
      [host, second, third].forEach((engine) => game.addPlayer(engine));

      game.removePlayer(host);

      expect(game.host).toBe('p2');
      expect(second.isHost).toBe(true);
      expect(third.isHost).toBe(false);
      expect(game.size).toBe(2);
    });

    it('keeps the host when somebody else leaves', () => {
      const host = makeEngine('host-1');
      const second = makeEngine('p2');
      game.addPlayer(host);
      game.addPlayer(second);

      game.removePlayer(second);

      expect(game.host).toBe('host-1');
      expect(host.isHost).toBe(true);
    });

    it('disposes of the room once the last player leaves', () => {
      const onEmpty = vi.fn();
      const room = new Game('solo', 'host-1', io, { onEmpty });
      const host = makeEngine('host-1');
      room.addPlayer(host);

      room.removePlayer(host);

      expect(room.size).toBe(0);
      expect(room.host).toBeNull();
      expect(onEmpty).toHaveBeenCalledWith(room);
    });
  });

  describe('modes', () => {
    it('lets the host switch mode between two rounds', () => {
      expect(game.setMode(INVISIBLE)).toBe(true);
      expect(game.mode).toBe(INVISIBLE);
    });

    it('refuses an unknown mode or a mode change mid-game', () => {
      expect(game.setMode('nope')).toBe(false);
      game.isRunning = true;
      expect(game.setMode(GRAVITY)).toBe(false);
      expect(game.mode).toBe('classic');
    });
  });

  describe('rounds', () => {
    let host;
    let challenger;

    beforeEach(() => {
      host = makeEngine('host-1');
      challenger = makeEngine('p2');
      game.addPlayer(host);
      game.addPlayer(challenger);
    });

    it('starts a round for everyone with a brand new sequence', () => {
      const previous = game.tetrominos;
      game.startGames();

      expect(game.isRunning).toBe(true);
      expect(game.tetrominos).not.toBe(previous);
      expect(host.reset).toHaveBeenCalled();
      expect(host.start).toHaveBeenCalled();
      expect(challenger.tetrominos).toBe(game.tetrominos);
      expect(io.roomEmit).toHaveBeenCalledWith('allPlayersDone', false);
      expect(io.roomEmit).toHaveBeenCalledWith('gameStarted', { mode: 'classic' });
    });

    it('counts the players still standing', () => {
      game.startGames();
      expect(game.playersStillPlaying()).toBe(2);
      expect(game.allPlayersDone()).toBe(false);

      host.isRunning = false;
      expect(game.playersStillPlaying()).toBe(1);
      expect(game.lastPlayerStanding()).toBe(challenger);
    });

    it('declares the last player standing the winner', () => {
      game.startGames();
      host.isRunning = false;
      game.onPlayerFinished(host);

      expect(challenger.gameOver).toBe(true);
      expect(challenger.stop).toHaveBeenCalled();
      expect(io.roomEmit).toHaveBeenCalledWith('Winner', {
        socketId: 'p2',
        username: 'p2',
      });
      expect(io.roomEmit).toHaveBeenCalledWith('allPlayersDone', true);
      expect(game.isRunning).toBe(false);
    });

    it('does not end the round while two players are still alive', () => {
      game.startGames();
      expect(game.checkGameEnd()).toBe(false);
      expect(game.isRunning).toBe(true);
    });

    it('ends a solo game when its only player tops out', () => {
      const solo = new Game('solo', 'host-1', io);
      const only = makeEngine('host-1');
      solo.addPlayer(only);
      solo.startGames();

      expect(solo.checkGameEnd()).toBe(false);

      only.isRunning = false;
      solo.onPlayerFinished(only);

      expect(solo.isRunning).toBe(false);
      expect(io.roomEmit).toHaveBeenCalledWith('allPlayersDone', true);
      expect(io.roomEmit).not.toHaveBeenCalledWith(
        'Winner',
        expect.objectContaining({ socketId: 'host-1' })
      );
    });

    it('ends the round when the second-to-last player disconnects', () => {
      game.startGames();
      game.removePlayer(host);
      expect(game.isRunning).toBe(false);
    });

    it('ignores an end check outside of a round', () => {
      expect(game.checkGameEnd()).toBe(false);
    });
  });

  describe('score persistence', () => {
    it('records a finished player on the scoreboard', () => {
      const scoreboard = { record: vi.fn() };
      const room = new Game('scored', 'host-1', io, { scoreboard });
      const host = makeEngine('host-1', 'Alice');
      host.score = 1200;
      host.clearedLines = 7;
      room.addPlayer(host);

      room.recordScore(host, true);

      expect(scoreboard.record).toHaveBeenCalledWith({
        username: 'Alice',
        score: 1200,
        lines: 7,
        level: 1,
        room: 'scored',
        mode: 'classic',
        won: true,
      });
    });

    it('records nothing without a scoreboard or a username', () => {
      const scoreboard = { record: vi.fn() };
      const room = new Game('scored', 'host-1', io, { scoreboard });
      const anonymous = makeEngine('p1', null);

      expect(() => game.recordScore(makeEngine('p1'), false)).not.toThrow();
      room.recordScore(anonymous, false);
      expect(scoreboard.record).not.toHaveBeenCalled();
    });
  });
});

describe('spectators and chat (bonus)', () => {
  let io;
  let game;

  beforeEach(() => {
    io = makeIo();
    game = new Game('lobby', 'h', io);
  });

  it('keeps the audience out of the roster and of the end-of-game maths', () => {
    game.addPlayer(makeEngine('p1'));
    game.addSpectator('watcher', 'Eve');

    expect(game.size).toBe(1);
    expect(game.spectators.size).toBe(1);
    expect(game.playersStillPlaying()).toBe(0);
    expect(game.serializePlayers().spectators).toEqual([
      { socketId: 'watcher', username: 'Eve' },
    ]);
  });

  it('gives up a seat only once', () => {
    game.addSpectator('watcher', 'Eve');

    expect(game.removeSpectator('watcher')).toBe(true);
    expect(game.removeSpectator('watcher')).toBe(false);
  });

  it('closes the room and sends the audience home with the last player', () => {
    const engine = makeEngine('p1');
    game.onEmpty = vi.fn();
    game.addPlayer(engine);
    game.addSpectator('watcher', 'Eve');

    game.removePlayer(engine);

    expect(io.roomEmit).toHaveBeenCalledWith('roomClosed', { name: 'lobby' });
    expect(game.spectators.size).toBe(0);
    expect(game.onEmpty).toHaveBeenCalledWith(game);
  });

  it('does not announce a closure when nobody was watching', () => {
    const engine = makeEngine('p1');
    game.addPlayer(engine);

    game.removePlayer(engine);

    expect(io.roomEmit).not.toHaveBeenCalledWith('roomClosed', expect.anything());
  });

  it('relays a chat message to everybody in the room', () => {
    const message = { username: 'Eve', text: 'gg' };

    expect(game.broadcastChat(message)).toBe(message);
    expect(io.to).toHaveBeenCalledWith('lobby');
    expect(io.roomEmit).toHaveBeenCalledWith('chatMessage', message);
  });

  it('counts the audience in the lobby listing', () => {
    game.addPlayer(makeEngine('p1'));
    game.addSpectator('watcher', 'Eve');

    expect(listOpenRooms(new Map([['lobby', game]]))[0].spectators).toBe(1);
  });
});

describe('roomExists / listOpenRooms', () => {
  it('answers from the server room registry', () => {
    const rooms = new Map([['lobby', new Game('lobby', 'h', makeIo())]]);
    expect(roomExists(rooms, 'lobby')).toBe(true);
    expect(roomExists(rooms, 'nope')).toBe(false);
    expect(roomExists(null, 'lobby')).toBe(false);
  });

  it('summarises the open rooms for the lobby', () => {
    const io = makeIo();
    const game = new Game('lobby', 'h', io);
    game.addPlayer(makeEngine('h'));

    expect(listOpenRooms(new Map([['lobby', game]]))).toEqual([
      { name: 'lobby', players: 1, spectators: 0, mode: 'classic', isRunning: false },
    ]);
  });
});
