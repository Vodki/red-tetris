import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../game/Engine.js';
import { Piece } from '../game/Tetromino.js';
import { GRAVITY, INVISIBLE } from '../game/pure/rules.js';
import { GHOST, ghostBlocks } from '../game/pure/board.js';

const makeSocket = (id = 'socket-1') => ({
  id,
  handlers: new Map(),
  emit: vi.fn(),
  leave: vi.fn(),
  on(event, handler) {
    this.handlers.set(event, handler);
  },
  fire(event, payload) {
    const handler = this.handlers.get(event);
    if (handler) handler(payload);
  },
});

const makeRoom = (mode = 'classic') => ({
  name: 'room',
  mode,
  engines: new Map(),
  io: { to: vi.fn().mockReturnThis(), emit: vi.fn() },
  onPlayerFinished: vi.fn(),
});

/** A deterministic sequence: only O pieces, easy to place. */
const sequence = () => [new Piece('O'), new Piece('O')];

const makePlayer = (socket = makeSocket(), room = makeRoom()) => {
  const player = new Player(socket, true, sequence());
  player.username = socket.id;
  player.room = room;
  room.engines.set(player.socketId, player);
  return player;
};

describe('Player', () => {
  let socket;
  let room;
  let player;

  beforeEach(() => {
    vi.useFakeTimers();
    socket = makeSocket();
    room = makeRoom();
    player = makePlayer(socket, room);
  });

  afterEach(() => {
    player.stop();
    vi.useRealTimers();
  });

  it('starts on an empty board with a fresh score', () => {
    expect(player.score).toBe(0);
    expect(player.level).toBe(1);
    expect(player.clearedLines).toBe(0);
    expect(player.pieceNb).toBe(0);
    expect(player.gameOver).toBe(false);
    expect(player.board.spectrum()).toEqual(Array(10).fill(0));
  });

  it('walks through the shared sequence and extends it on demand', () => {
    const shared = player.tetrominos;
    expect(player.pieceAt(0).id).toBe(shared[0].id);
    player.pieceAt(5);
    expect(shared.length).toBeGreaterThanOrEqual(7);
  });

  it('hands out clones, never the shared piece itself', () => {
    const shared = player.tetrominos;
    player.pieceAt(0).moveBy(5, 5);
    expect(shared[0].position).toEqual({ x: 4, y: 0 });
  });

  it('exposes the next piece of the sequence', () => {
    expect(player.nextPiece.id).toBe(player.tetrominos[1].id);
  });

  describe('inputs', () => {
    beforeEach(() => player.start());

    it('moves left and right, and refuses to cross the walls', () => {
      const startX = player.current.position.x;
      expect(player.moveLeft()).toBe(true);
      expect(player.current.position.x).toBe(startX - 1);
      expect(player.moveRight()).toBe(true);
      expect(player.current.position.x).toBe(startX);

      for (let i = 0; i < 10; i += 1) player.moveLeft();
      expect(player.current.position.x).toBe(0);
      expect(player.moveLeft()).toBe(false);
    });

    it('rotates, and rolls the rotation back when it does not fit', () => {
      player.current = new Piece('I', { x: 0, y: 5 });
      expect(player.rotateCurrent()).toBe(true);

      // An I piece hugging the left wall cannot go back to horizontal.
      player.current = new Piece('I', { x: 0, y: 5 }, 1);
      const before = player.current.rotationIndex;
      expect(player.rotateCurrent()).toBe(false);
      expect(player.current.rotationIndex).toBe(before);
    });

    it('soft drop moves down one row and scores a point', () => {
      const y = player.current.position.y;
      player.moveDown();
      expect(player.current.position.y).toBe(y + 1);
      expect(player.score).toBe(1);
    });

    it('soft drop never locks the piece by itself', () => {
      while (player.canMoveDown()) player.moveDown();
      const pieceNb = player.pieceNb;
      player.moveDown();
      expect(player.pieceNb).toBe(pieceNb);
      expect(player.landed).toBe(true);
    });

    it('hard drop settles the piece immediately and spawns the next one', () => {
      player.hardDrop();
      expect(player.pieceNb).toBe(1);
      expect(player.board.spectrum().some((height) => height > 0)).toBe(true);
      expect(player.score).toBeGreaterThan(0);
    });

    it('routes socket commands to the matching action', () => {
      const spies = {
        rotateCurrent: vi.spyOn(player, 'rotateCurrent'),
        moveLeft: vi.spyOn(player, 'moveLeft'),
        moveRight: vi.spyOn(player, 'moveRight'),
        moveDown: vi.spyOn(player, 'moveDown'),
        hardDrop: vi.spyOn(player, 'hardDrop'),
      };

      socket.fire('gameInput', 'Rotate');
      socket.fire('gameInput', 'MoveLeft');
      socket.fire('gameInput', 'MoveRight');
      socket.fire('gameInput', 'MoveDown');
      socket.fire('gameInput', 'HardDrop');
      socket.fire('gameInput', 'Nonsense');

      Object.values(spies).forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    });

    it('ignores inputs once the game is over', () => {
      player.gameOver = true;
      expect(player.moveLeft()).toBe(false);
      expect(player.moveDown()).toBe(false);
      expect(player.hardDrop()).toBe(false);
      expect(player.rotateCurrent()).toBe(false);
    });
  });

  describe('falling', () => {
    it('falls one row per frame', () => {
      player.start();
      const y = player.current.position.y;
      vi.advanceTimersByTime(500);
      expect(player.current.position.y).toBe(y + 1);
    });

    it('stays movable for one extra frame after touching the pile', () => {
      player.start();
      while (player.canMoveDown()) player.current.moveBy(0, 1);

      // First frame on the floor: the piece only gets flagged as landed.
      vi.advanceTimersByTime(500);
      expect(player.landed).toBe(true);
      expect(player.pieceNb).toBe(0);

      // Sliding it sideways cancels the lock while it can fall again.
      expect(player.moveLeft()).toBe(true);

      // Second frame: it finally settles.
      vi.advanceTimersByTime(500);
      expect(player.pieceNb).toBe(1);
    });

    it('does nothing once stopped', () => {
      player.start();
      player.stop();
      const y = player.current.position.y;
      vi.advanceTimersByTime(2000);
      expect(player.current.position.y).toBe(y);
    });
  });

  describe('lines, score and level', () => {
    it('clears a line, scores it and counts it', () => {
      player.start();
      // One gap left on the bottom row, filled by the O piece about to settle.
      player.board.grid = player.board.grid.map((row, y) =>
        y === 19 ? [1, 1, 1, 1, 1, 1, 0, 0, 1, 1] : row
      );
      player.current = new Piece('O', { x: 6, y: 18 });
      player.lockAndSpawn();

      expect(player.clearedLines).toBe(1);
      expect(player.score).toBe(100);
    });

    it('levels up every ten lines and re-arms the timer', () => {
      player.start();
      const schedule = vi.spyOn(player, 'scheduleTick');
      player.clearedLines = 9;
      player.board.grid = player.board.grid.map((row, y) =>
        y === 19 ? Array(10).fill(1) : row
      );
      player.lockAndSpawn();

      expect(player.level).toBe(2);
      expect(schedule).toHaveBeenCalled();
    });

    it('speeds up in the gravity mode only', () => {
      room.mode = GRAVITY;
      player.level = 3;
      player.start();
      expect(player.mode).toBe(GRAVITY);

      room.mode = 'classic';
      expect(player.mode).toBe('classic');
    });
  });

  describe('penalties', () => {
    let opponent;

    beforeEach(() => {
      opponent = makePlayer(makeSocket('socket-2'), room);
      opponent.tetrominos = player.tetrominos;
      opponent.reset();
      player.start();
      opponent.start();
    });

    afterEach(() => opponent.stop());

    it('sends n-1 indestructible lines to the opponents', () => {
      player.sendPenalty(2);
      expect(opponent.board.grid[19].every((cell) => cell === -1)).toBe(true);
      expect(opponent.board.grid[18].every((cell) => cell === -1)).toBe(true);
      expect(opponent.board.clearFullLines()).toBe(0);
    });

    it('never punishes the sender', () => {
      player.sendPenalty(3);
      expect(player.board.spectrum()).toEqual(Array(10).fill(0));
    });

    it('skips the players who are already out', () => {
      opponent.isRunning = false;
      player.sendPenalty(2);
      expect(opponent.board.spectrum()).toEqual(Array(10).fill(0));
    });

    it('ends the game of an opponent pushed past the ceiling', () => {
      opponent.board.lock([{ x: 0, y: 0 }], 3);
      player.sendPenalty(1);
      expect(opponent.gameOver).toBe(true);
      expect(opponent.isRunning).toBe(false);
    });

    it('clearing two lines sends exactly one penalty line', () => {
      const spy = vi.spyOn(player, 'sendPenalty');
      player.board.grid = player.board.grid.map((row, y) =>
        y >= 18 ? Array(10).fill(1) : row
      );
      player.lockAndSpawn();
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('clearing a single line sends nothing', () => {
      const spy = vi.spyOn(player, 'sendPenalty');
      player.board.grid = player.board.grid.map((row, y) =>
        y === 19 ? Array(10).fill(1) : row
      );
      player.lockAndSpawn();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('game over', () => {
    it('ends when a new piece can no longer enter the field', () => {
      player.start();
      player.board.grid = player.board.grid.map((row, y) =>
        y <= 2 ? Array(10).fill(2) : row
      );
      player.spawnNewTetromino();

      expect(player.gameOver).toBe(true);
      expect(player.isRunning).toBe(false);
      expect(room.onPlayerFinished).toHaveBeenCalledWith(player);
    });

    it('only reports the end once', () => {
      player.start();
      player.endGame();
      player.endGame();
      expect(room.onPlayerFinished).toHaveBeenCalledTimes(1);
    });
  });

  describe('what goes over the wire', () => {
    it('sends its own grid, spectrum and next piece to its owner', () => {
      player.sendGameState();
      const [event, payload] = socket.emit.mock.calls.at(-1);

      expect(event).toBe('GameUpdate');
      expect(payload.grid).toHaveLength(20);
      expect(payload.spectrum).toHaveLength(10);
      expect(payload.nextPiece.id).toBeDefined();
      expect(payload.score).toBe(0);
    });

    it('only broadcasts a spectrum to the room, never a grid', () => {
      player.sendSpectrum();
      const [event, payload] = room.io.emit.mock.calls.at(-1);

      expect(room.io.to).toHaveBeenCalledWith('room');
      expect(event).toBe('SpectrumUpdate');
      expect(payload.spectrum).toHaveLength(10);
      expect(payload.grid).toBeUndefined();
    });

    it('hides the pile in the invisible mode', () => {
      room.mode = INVISIBLE;
      player.board.lock([{ x: 0, y: 19 }], 4);
      const grid = player.getVisualGrid();
      expect(grid[19][0]).toBe(0);
    });

    it('reveals the pile once the invisible game is over', () => {
      room.mode = INVISIBLE;
      player.board.lock([{ x: 0, y: 19 }], 4);
      expect(player.getVisualGrid()[19][0]).toBe(0);

      player.endGame();
      expect(player.getVisualGrid()[19][0]).toBe(4);

      const [, payload] = player.socket.emit.mock.calls
        .filter(([event]) => event === 'GameUpdate')
        .at(-1);
      expect(payload.gameOver).toBe(true);
      expect(payload.grid[19][0]).toBe(4);
    });

    it('keeps the landing preview in the invisible mode', () => {
      room.mode = INVISIBLE;
      player.board.lock([{ x: 0, y: 19 }], 4);
      const grid = player.getVisualGrid();
      const landing = ghostBlocks(player.board.grid, player.current.blocks);
      landing.forEach(({ x, y }) => expect(grid[y][x]).not.toBe(0));
      expect(grid.some((row) => row.includes(GHOST))).toBe(true);
    });

    it('shows the pile in the classic mode', () => {
      player.board.lock([{ x: 0, y: 19 }], 4);
      expect(player.getVisualGrid()[19][0]).toBe(4);
    });

    it('does not broadcast a spectrum without a room', () => {
      player.room = null;
      expect(() => player.sendSpectrum()).not.toThrow();
    });
  });

  describe('disconnect', () => {
    it('leaves the room and stops the loop', () => {
      room.removePlayer = vi.fn();
      player.start();
      player.disconnect();

      expect(player.isRunning).toBe(false);
      expect(room.removePlayer).toHaveBeenCalled();
      expect(socket.leave).toHaveBeenCalledWith('room');
      expect(player.room).toBeNull();
    });

    it('is harmless when the player is in no room', () => {
      player.room = null;
      expect(() => player.disconnect()).not.toThrow();
    });
  });
});
