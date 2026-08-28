import { newRandomTetromino } from './Tetromino.js';
import { DEFAULT_MODE, isGameMode } from './pure/rules.js';

/**
 * Server side model of a game (a "room").
 *
 * Owns the players, the shared piece sequence and the life cycle of a round.
 */
export class Game {
  constructor(name, host, io, options = {}) {
    this.io = io;
    this.name = name;
    this.host = host;
    this.engines = new Map();
    this.isRunning = false;
    // Whether the round in progress was started by a lone player: a solo game
    // runs until its player tops out, a multiplayer one ends as soon as a
    // single player is left standing.
    this.soloRound = true;
    this.mode = isGameMode(options.mode) ? options.mode : DEFAULT_MODE;
    this.scoreboard = options.scoreboard || null;
    this.onEmpty = options.onEmpty || null;
    // Notifies the server that the lobby listing is stale: the round may have
    // ended, or the roster / mode changed.
    this.onUpdate = options.onUpdate || null;
    this.tetrominos = Game.newSequence();
  }

  /** A fresh shared piece sequence — two pieces are enough to bootstrap. */
  static newSequence() {
    return [newRandomTetromino(), newRandomTetromino()];
  }

  get size() {
    return this.engines.size;
  }

  addPlayer(engine) {
    engine.room = this;
    engine.tetrominos = this.tetrominos;
    engine.isHost = engine.socketId === this.host;
    this.engines.set(engine.socketId, engine);
    this.roomUpdate();
    return engine;
  }

  /**
   * Removes a player. If they were the host, one of the remaining players
   * takes over the role; if the room becomes empty it is disposed of.
   */
  removePlayer(engine) {
    this.engines.delete(engine.socketId);

    if (this.engines.size === 0) {
      this.isRunning = false;
      this.host = null;
      if (this.onEmpty) this.onEmpty(this);
      return;
    }

    if (this.host === engine.socketId) this.reassignHost();

    this.roomUpdate();
    if (this.isRunning) this.checkGameEnd();
  }

  /** Promotes the longest-standing remaining player to host. */
  reassignHost() {
    const [nextHost] = this.engines.keys();
    this.host = nextHost === undefined ? null : nextHost;
    this.engines.forEach((engine) => {
      engine.isHost = engine.socketId === this.host;
    });
    return this.host;
  }

  /** Game modes can only be changed between two rounds, by the host. */
  setMode(mode) {
    if (this.isRunning || !isGameMode(mode)) return false;
    this.mode = mode;
    this.roomUpdate();
    return true;
  }

  serializePlayers() {
    return {
      name: this.name,
      host: this.host,
      mode: this.mode,
      isRunning: this.isRunning,
      players: [...this.engines.values()].map((engine) => ({
        username: engine.username,
        socketId: engine.socketId,
        isHost: engine.socketId === this.host,
        spectrum: engine.board.spectrum(),
        score: engine.score,
        level: engine.level,
        lines: engine.clearedLines,
        gameOver: engine.gameOver,
        isRunning: engine.isRunning,
      })),
    };
  }

  roomUpdate() {
    this.io.to(this.name).emit('roomUpdate', this.serializePlayers());
    if (this.onUpdate) this.onUpdate(this);
  }

  playersStillPlaying() {
    return [...this.engines.values()].filter((engine) => engine.isRunning).length;
  }

  lastPlayerStanding() {
    return [...this.engines.values()].find((engine) => engine.isRunning) || null;
  }

  allPlayersDone() {
    return this.playersStillPlaying() === 0;
  }

  /** Starts (or restarts) a round for everyone in the room. */
  startGames() {
    this.tetrominos = Game.newSequence();

    this.engines.forEach((engine) => {
      engine.stop();
      engine.tetrominos = this.tetrominos;
      engine.reset();
    });

    this.soloRound = this.engines.size <= 1;
    this.isRunning = true;
    this.io.to(this.name).emit('allPlayersDone', false);
    this.io.to(this.name).emit('gameStarted', { mode: this.mode });

    this.engines.forEach((engine) => engine.start());
    this.roomUpdate();
  }

  /** Called by a player whose game just ended. */
  onPlayerFinished(engine) {
    this.recordScore(engine, false);
    this.checkGameEnd();
  }

  /**
   * A multiplayer game ends as soon as a single player is left standing; a solo
   * game ends when that player tops out.
   */
  checkGameEnd() {
    if (!this.isRunning) return false;

    const remaining = this.playersStillPlaying();
    if (this.soloRound ? remaining > 0 : remaining > 1) return false;

    const winner = this.soloRound ? null : this.lastPlayerStanding();

    if (winner) {
      winner.gameOver = true;
      winner.stop();
      winner.sendGameState();
      winner.sendSpectrum();
      this.recordScore(winner, true);
      this.io.to(this.name).emit('Winner', {
        socketId: winner.socketId,
        username: winner.username,
      });
    }

    this.isRunning = false;
    this.io.to(this.name).emit('allPlayersDone', true);
    this.roomUpdate();
    return true;
  }

  /** Bonus: persists the score of a finished player. */
  recordScore(engine, won) {
    if (!this.scoreboard || !engine.username) return;
    this.scoreboard.record({
      username: engine.username,
      score: engine.score,
      lines: engine.clearedLines,
      level: engine.level,
      room: this.name,
      mode: this.mode,
      won: Boolean(won),
    });
  }
}

/** A room exists as soon as the server knows about it. */
export const roomExists = (rooms, roomName) => Boolean(rooms && rooms.has(roomName));

/** Public summary of the open rooms, used by the lobby. */
export const listOpenRooms = (rooms) =>
  [...rooms.values()].map((room) => ({
    name: room.name,
    players: room.engines.size,
    mode: room.mode,
    isRunning: room.isRunning,
  }));
