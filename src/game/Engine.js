import { Board } from './Board.js';
import { newRandomTetromino } from './Tetromino.js';

const ROWS = 20;
const COLS = 10;
const INITIAL_SPEED = 500;

export class Player{
  constructor(socket, isHost, tetrominos) {
    this.tetrominos = tetrominos
    this.reset()
    this.socket = socket;
    this.socketId = socket.id
    this.intervalId = null;
    this.username = null;
    this.isRunning = false;
    this.room = null;
    this.isHost = isHost;

    this.initializeSocketHandlers();
  }

  disconnect() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.room == null) {
      return
    } else if (this.room.engines.size == 1) {
      this.socket.leave(this.room.name)
      this.room = null;
      return;
    } else if (this.room.host != null && this.room.host == this.socketId) {
      const newHostFound = false
      this.room.engines.forEach((engine) => {
        if (engine.room != null && (!newHostFound && engine.socketId != engine.room.host)) {
          engine.room.host = engine.socketId
          this.isHost = true
        }
      })
    }
    this.room.engines.delete(this.socketId)
    this.room.roomUpdate()
    this.socket.leave(this.room.name)
  }

  sendPenality(linesNb) {
    this.room.engines.forEach((engine) => {
      if (engine.socketId == this.socketId || engine.isRunning == false) {
        return;
      } else if(!engine.board.addPenality(linesNb)) {
        engine.isRunning = false;
      }
      engine.sendGameShadow();
    })
  }

  initializeSocketHandlers() {
    this.socket.on('gameInput', (command) => {
      if (!this.isRunning) return;
      
      switch(command) {
        case 'Rotate': this.rotateCurrent(); break;
        case 'MoveLeft': this.moveLeft(); break;
        case 'MoveRight': this.moveRight(); break;
        case 'MoveDown': this.moveDown(); break;
        case 'HardDrop': this.hardDrop(); break;
      }
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.intervalId = setInterval(() => this.tick(), INITIAL_SPEED);
    this.sendGameState();
  }

  stop() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }

  reset() {
    this.board = new Board();
    this.current = this.tetrominos[0].clone();
    this.gameOver = false;
    this.score = 0;
    this.level = 1;
    this.clearedLines = 0;
    this.pieceNb = 0;
  }

  calculateScore(lines) {
    switch(lines) {
      case 1: return 100 * this.level;
      case 2: return 300 * this.level;
      case 3: return 500 * this.level;
      case 4: return 800 * this.level;
      default: return 0;
    }
  }

  tick() {
    if (this.gameOver) return;

    if (this.canMoveDown()) {
      this.current.position.y++;
    }
    else {
      this.lockCurrent();
      const n = this.board.clearFullLines();
      if (n > 1) {
        this.sendPenality(n - 1);
      }
      this.score += this.calculateScore(n);
      if (Math.floor((n + this.clearedLines) / 10) > Math.floor(this.clearedLines/10)) {
        this.level++
      }
      this.spawnNewTetromino()
      if (!this.isValidPosition(this.current)) {
        this.gameOver = true;
      }
    }
    this.sendGameShadow();
    this.sendGameState();
  }

  lockCurrent() {
    const shape = this.current.currentShape;
    for (const block of shape) {
      const x = this.current.position.x + block.x;
      const y = this.current.position.y + block.y;
      if (y >= 0) {
        this.board.fillBoard(x, y, this.current.color);
      }
    }

    
  }

  spawnNewTetromino() {
    if (this.pieceNb == this.tetrominos.length - 1) {
      this.tetrominos.push(newRandomTetromino());
    }
    this.pieceNb++;
    this.current = this.tetrominos[this.pieceNb].clone();
    
    if (!this.isValidPosition(this.current)) {
      this.gameOver = true;
      this.handleGameOver();
    }
  }

  updateGameState(clearedLines) {
    this.clearedLines += clearedLines;
    this.score += this.calculateScore(clearedLines);
    
    if (Math.floor((n + this.clearedLines) / 10) > Math.floor(this.clearedLines/10)) {
      this.level++;
    }
  }

  isValidPosition(tetromino) {
    const shape = tetromino.currentShape;
    for (const block of shape) {
      const x = tetromino.position.x + block.x;
      const y = tetromino.position.y + block.y;

      if (x < 0 || x >= COLS) {
        return false;
      }
      if (y >= ROWS) {
        return false;
      }
      if (y >= 0 && this.board.grid[y]?.[x] !== 0) {
        return false;
      }
    }

    return true;
  }

  canMoveDown() {
    const testPiece = this.current.clone();
    testPiece.position.y++;
    const bool = this.isValidPosition(testPiece)
    if (!bool) {
    }
    return bool;
  }

  rotateCurrent() {
    const originalRotation = this.current.rotationIndex;
    this.current.rotate();
    
    if (!this.isValidPosition(this.current)) {
      this.current.rotationIndex = originalRotation;
    }
    this.sendGameState();
  }

  moveLeft() {
    this.current.position.x--;
    if (!this.isValidPosition(this.current)) {
      this.current.position.x++;
    }
    this.sendGameState();
  }

  moveRight() {
    this.current.position.x++;
    if (!this.isValidPosition(this.current)) {
      this.current.position.x--;
    }
    this.sendGameState();
  }

  moveDown() {
    if (this.canMoveDown()) {
      this.current.position.y++;
    } else {
      this.lockCurrent();
      const n = this.board.clearFullLines();
      if (n > 1) {
        this.sendPenality(n - 1);
      }
      this.score += this.calculateScore(n);
      if (Math.floor((n + this.clearedLines) / 10) > Math.floor(this.clearedLines/10)) {
        this.level++
      }
      this.spawnNewTetromino()
      if (!this.isValidPosition(this.current)) {
        this.gameOver = true;
      }
    }
    this.score += this.level
    this.sendGameState();
  }

  hardDrop() {
    let dropDistance = 0;
    while (this.canMoveDown()) {
      this.current.position.y++;
      dropDistance++;
    }
    this.lockCurrent();
    const n = this.board.clearFullLines();
    if (n > 1) {
      this.sendPenality(n - 1);
    }
    this.score += this.calculateScore(n);
    if (Math.floor((n + this.clearedLines) / 10) > Math.floor(this.clearedLines/10)) {
      this.level++
    }
    this.spawnNewTetromino()
    if (!this.isValidPosition(this.current)) {
      this.gameOver = true;
    }
    this.score += dropDistance * this.level
    this.sendGameState();
  }

  sendGameState() {
    const state = {
      grid: this.getVisualGrid(),
      score: this.score,
      level: this.level,
      nextPiece: this.next,
      gameOver: this.gameOver,
    };
    this.room.allPlayersDone();
    this.socket.emit('GameUpdate', state);
  }

  sendGameShadow() {
    const state = {
      grid: this.board.grid,
      score: this.score,
      level: this.level,
      nextPiece: this.next,
      gameOver: this.gameOver,
      socketId: this.socketId,
    };

    this.room.io.to(this.room.name).emit('GameShadow', state);
  }

  getVisualGrid() {
    const grid = this.board.gridCopy();
    this.addGhostPiece(grid);
    this.addCurrentPiece(grid);
    return grid;
  }

  addGhostPiece(grid) {
    const ghost = this.current.clone();
    while (this.isValidPosition(ghost)) {
      ghost.position.y++;
    }
    ghost.position.y--;
    
    ghost.currentShape.forEach(block => {
      const x = ghost.position.x + block.x;
      const y = ghost.position.y + block.y;
      if (y >= 0 && x >= 0 && x < COLS && y < ROWS) {
        grid[y][x] = 9;
      }
    });
  }

  addCurrentPiece(grid) {
    this.current.currentShape.forEach(block => {
      const x = this.current.position.x + block.x;
      const y = this.current.position.y + block.y;
      if (y >= 0 && x >= 0 && x < COLS && y < ROWS) {
        grid[y][x] = this.current.color;
      }
    });
  }

  handleGameOver() {
    this.stop();
    this.sendGameShadow();
    if (this.room.engines.size == 1) {
      return;
    } else if (this.room.playersStillPlaying() == 1) {
      const player = this.room.lastPlayerSocketId()
      const engine = this.room.engines.get(player)
      engine.gameOver = true;
      engine.stop();
      engine.sendGameShadow();
      this.room.io.to(this.room.name).emit('allPlayersDone', true)
      this.room.io.to(this.room.name).emit('Winner', {socketId: player});
      engine.reset();
    }
  }
}

