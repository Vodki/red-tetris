import { EventEmitter } from 'events';
import { Board } from './Board.js';
import { newRandomTetromino } from './Tetromino.js';

const ROWS = 20;
const COLS = 10;
const INITIAL_SPEED = 500;

export class GameEngine extends EventEmitter{
  constructor(socket) {
    super();
    this.reset()
    this.socket = socket;
    this.intervalId = null;
    this.username = '';
    this.isRunning = false;

    this.initializeSocketHandlers();
  }

  initializeSocketHandlers() {
    this.socket.on('start', (username) => {
      this.username = username;
      this.start();
    });

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
    this.current = newRandomTetromino();
    this.next = newRandomTetromino();
    this.gameOver = false;
    this.score = 0;
    this.level = 1;
    this.clearedLines = 0;
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
      //console.log(this.board.grid)
      this.current.position.y++;
    }
    else {
      this.lockCurrent();
      const n = this.board.clearFullLines();
      this.score += this.calculateScore(n);
      if ((n + this.clearedLines) / 10 > this.clearedLines/10) {
        this.level++
      }
      this.spawnNewTetromino()
      if (!this.isValidPosition(this.current)) {
        this.gameOver = true;
      }
      this.spawnNewTetromino();
    }
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
    this.current = this.next;
    this.next = newRandomTetromino();
    
    if (!this.isValidPosition(this.current)) {
      this.gameOver = true;
      this.handleGameOver();
    }
  }

  updateGameState(clearedLines) {
    this.clearedLines += clearedLines;
    this.score += this.calculateScore(clearedLines);
    
    if ((clearedLines + this.clearedLines) / 10 > this.clearedLines / 10) {
      this.level++;
    }
  }

/*  isValidPosition(tetromino) {
    return tetromino.currentShape.every(block => {
      const x = tetromino.position.x + block.x;
      const y = tetromino.position.y + block.y;
      
      return x >= 0 && x < COLS && 
             y < ROWS && 
             (y < 0 || this.board.grid[y][x] === 0);
    });
  } */

  isValidPosition(tetromino) {
    const shape = tetromino.currentShape;
    for (const block of shape) {
      // Convert relative to board coordinates
      const x = tetromino.position.x + block.x;
      const y = tetromino.position.y + block.y;

      // Boundary checks
      if (x < 0 || x >= COLS) {
        return false;
      }
      if (y >= ROWS) {
        return false;
      }
      if (y >= 0 && this.board.grid[y]?.[x] !== 0) {
        //console.log(this.board.grid)
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

  // Movement methods
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
      this.score += this.calculateScore(n);
      if ((n + this.clearedLines) / 10 > this.clearedLines/10) {
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
    this.score += this.calculateScore(n);
    if ((n + this.clearedLines) / 10 > this.clearedLines/10) {
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
      gameOver: this.gameOver
    };

    this.socket.emit('GameUpdate', state);
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
        grid[y][x] = 9; // Ghost color indicator
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
    // Save score to leaderboard
    this.socket.emit('game-over', {
      username: this.username,
      score: this.score
    });
  }
}