import { Board } from './Board.js';
import { Piece, newRandomTetromino } from './Tetromino.js';
import {
  DEFAULT_MODE,
  levelForLines,
  penaltyForLines,
  pileIsHidden,
  scoreForLines,
  speedForLevel,
} from './pure/rules.js';

/**
 * Server side model of a player.
 *
 * Owns one board, one falling piece and the socket that drives them. All the
 * board/piece maths is delegated to `Board` and to the pure modules.
 */
export class Player {
  /**
   * @param socket      the player's socket.io socket
   * @param isHost      whether this player currently hosts the room
   * @param tetrominos  the *shared* piece sequence owned by the room, so that
   *                    every player of a game receives the very same pieces,
   *                    in the same order, at the same coordinates
   */
  constructor(socket, isHost, tetrominos) {
    this.socket = socket;
    this.socketId = socket.id;
    this.tetrominos = tetrominos;
    this.username = null;
    this.room = null;
    this.isHost = isHost;
    this.intervalId = null;
    this.isRunning = false;

    this.reset();
    this.initializeSocketHandlers();
  }

  get mode() {
    return this.room ? this.room.mode : DEFAULT_MODE;
  }

  /** Resets the field, the score and the piece cursor for a new round. */
  reset() {
    this.board = new Board();
    this.pieceNb = 0;
    this.current = this.pieceAt(0);
    this.gameOver = false;
    this.landed = false;
    this.score = 0;
    this.level = 1;
    this.clearedLines = 0;
    // Bonus: the piece put aside with the "hold" input, and the once-per-piece
    // guard that keeps the swap from being spammed.
    this.held = null;
    this.holdUsed = false;
  }

  /**
   * Returns a copy of the nth piece of the shared sequence, extending that
   * sequence when needed. Because the array is shared by every player of the
   * room, they all walk through the exact same pieces.
   */
  pieceAt(index) {
    while (this.tetrominos.length <= index + 1) {
      this.tetrominos.push(newRandomTetromino());
    }
    return this.tetrominos[index].clone();
  }

  get nextPiece() {
    return this.pieceAt(this.pieceNb + 1);
  }

  initializeSocketHandlers() {
    this.socket.on('gameInput', (command) => {
      if (!this.isRunning || this.gameOver) return;

      switch (command) {
        case 'Rotate':
          this.rotateCurrent();
          break;
        case 'MoveLeft':
          this.moveLeft();
          break;
        case 'MoveRight':
          this.moveRight();
          break;
        case 'MoveDown':
          this.moveDown();
          break;
        case 'HardDrop':
          this.hardDrop();
          break;
        case 'Hold':
          this.holdCurrent();
          break;
        default:
          break;
      }
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.gameOver = false;
    this.scheduleTick();
    this.sendGameState();
    this.sendSpectrum();
  }

  /** (Re)arms the falling timer at the speed of the current level and mode. */
  scheduleTick() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(
      () => this.tick(),
      speedForLevel(this.level, this.mode)
    );
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * One frame. A piece that touches the pile is not locked immediately: it
   * stays movable for one extra frame, which is what lets the player make the
   * last-moment adjustments the subject asks for.
   */
  tick() {
    if (this.gameOver || !this.isRunning) return;

    if (this.canMoveDown()) {
      this.current.moveBy(0, 1);
      this.landed = false;
    } else if (!this.landed) {
      this.landed = true;
    } else {
      this.lockAndSpawn();
    }

    this.sendGameState();
    this.sendSpectrum();
  }

  canMoveDown() {
    return this.board.isValid(this.current.clone().moveBy(0, 1).blocks);
  }

  /** Settles the piece, clears lines, punishes the opponents, spawns the next. */
  lockAndSpawn() {
    this.board.lock(this.current.blocks, this.current.color);

    const cleared = this.board.clearFullLines();
    if (cleared > 0) {
      this.clearedLines += cleared;
      this.score += scoreForLines(cleared, this.level);

      const level = levelForLines(this.clearedLines);
      if (level !== this.level) {
        this.level = level;
        if (this.isRunning) this.scheduleTick();
      }

      const penalty = penaltyForLines(cleared);
      if (penalty > 0) this.sendPenalty(penalty);
    }

    this.landed = false;
    this.spawnNewTetromino();
  }

  spawnNewTetromino() {
    this.pieceNb += 1;
    this.current = this.pieceAt(this.pieceNb);
    // A new piece re-arms the hold.
    this.holdUsed = false;

    // The game ends when a new piece can no longer enter the field.
    if (!this.board.isValid(this.current.blocks)) this.endGame();
  }

  /**
   * Bonus: "hold". Puts the falling piece aside and brings back the one that
   * was held before - or takes the next one of the shared sequence the first
   * time. As in the original game it can only be used once per piece, so it
   * cannot be turned into an infinite stall.
   *
   * The piece comes back at its spawn position and rotation, exactly as if it
   * had just entered the field.
   */
  holdCurrent() {
    if (!this.isRunning || this.gameOver || this.holdUsed) return false;

    const swapped = this.held;
    this.held = new Piece(this.current.id);

    if (swapped) {
      this.current = swapped;
    } else {
      this.pieceNb += 1;
      this.current = this.pieceAt(this.pieceNb);
    }

    this.holdUsed = true;
    this.landed = false;

    // The board may have grown too high while the piece was on hold.
    if (!this.board.isValid(this.current.blocks)) {
      this.endGame();
      return false;
    }

    this.sendGameState();
    return true;
  }

  /** Sends `count` indestructible lines to every opponent still playing. */
  sendPenalty(count) {
    if (!this.room) return;

    this.room.engines.forEach((engine) => {
      if (engine.socketId === this.socketId || !engine.isRunning) return;

      const survived = engine.board.addPenalty(count);

      // The falling piece may now overlap the pile: lift it above the penalty.
      if (!engine.board.isValid(engine.current.blocks)) {
        engine.current.moveBy(0, -count);
      }

      engine.sendGameState();
      engine.sendSpectrum();

      if (!survived || !engine.board.isValid(engine.current.blocks)) {
        engine.endGame();
      }
    });
  }

  /**
   * Applies `mutate`, rolls it back with `revert` when the resulting position
   * is invalid. Shared by the three "adjust the piece" inputs.
   */
  applyMove(mutate, revert) {
    if (!this.isRunning || this.gameOver) return false;

    mutate();
    if (!this.board.isValid(this.current.blocks)) {
      revert();
      return false;
    }

    // Moving off the pile gives the player another frame before locking.
    if (this.canMoveDown()) this.landed = false;
    this.sendGameState();
    return true;
  }

  rotateCurrent() {
    return this.applyMove(
      () => this.current.rotate(),
      () => this.current.rotateBack()
    );
  }

  moveLeft() {
    return this.applyMove(
      () => this.current.moveBy(-1, 0),
      () => this.current.moveBy(1, 0)
    );
  }

  moveRight() {
    return this.applyMove(
      () => this.current.moveBy(1, 0),
      () => this.current.moveBy(-1, 0)
    );
  }

  /** Soft drop: never locks on its own, the next frame does. */
  moveDown() {
    if (!this.isRunning || this.gameOver) return false;

    if (this.canMoveDown()) {
      this.current.moveBy(0, 1);
      this.landed = false;
      this.score += 1;
    } else {
      this.landed = true;
    }

    this.sendGameState();
    return true;
  }

  /** Hard drop: falls all the way down and locks straight away. */
  hardDrop() {
    if (!this.isRunning || this.gameOver) return false;

    let distance = 0;
    while (this.canMoveDown()) {
      this.current.moveBy(0, 1);
      distance += 1;
    }
    this.score += distance * 2;

    this.lockAndSpawn();
    this.sendGameState();
    this.sendSpectrum();
    return true;
  }

  /** The grid as its owner sees it. The pile is revealed once the game is over. */
  getVisualGrid() {
    const invisible = pileIsHidden(this.mode) && !this.gameOver;
    return this.board.render(this.current.blocks, this.current.color, {
      showGhost: true,
      invisible,
    });
  }

  sendGameState() {
    this.socket.emit('GameUpdate', {
      grid: this.getVisualGrid(),
      spectrum: this.board.spectrum(),
      nextPiece: this.nextPiece.serialize(),
      heldPiece: this.held ? this.held.serialize() : null,
      canHold: !this.holdUsed,
      score: this.score,
      level: this.level,
      lines: this.clearedLines,
      gameOver: this.gameOver,
      running: this.isRunning,
    });
  }

  /** Opponents only ever receive the spectrum, never the actual grid. */
  sendSpectrum() {
    if (!this.room) return;

    this.room.io.to(this.room.name).emit('SpectrumUpdate', {
      socketId: this.socketId,
      username: this.username,
      spectrum: this.board.spectrum(),
      score: this.score,
      level: this.level,
      lines: this.clearedLines,
      gameOver: this.gameOver,
    });
  }

  endGame() {
    if (this.gameOver && !this.isRunning) return;

    this.gameOver = true;
    this.stop();
    this.sendGameState();
    this.sendSpectrum();

    if (this.room) this.room.onPlayerFinished(this);
  }

  /** Leaves the room, letting it deal with host hand-over and end of game. */
  disconnect() {
    this.stop();

    const room = this.room;
    this.room = null;
    if (!room) return;

    room.removePlayer(this);
    this.socket.leave(room.name);
  }
}
