import { newRandomTetromino } from "./Tetromino.js";

export class Game {
  constructor(name, host, io) {
    this.io = io
    this.name = name;
    this.engines = new Map();
    this.host = host
    this.isRunning = false
    this.tetrominos = [];
    this.tetrominos.push(newRandomTetromino());
    this.tetrominos.push(newRandomTetromino());
  }

  roomUpdate() {
    this.io.to(this.name).emit('roomUpdate', this.serializePlayers())
  }

  serializePlayers() {
    const players = [];
    this.engines.forEach((engine) => {
      players.push({
        username: engine.username,
        socketId: engine.socketId,
        grid: engine.getVisualGrid(),
      });
    });

    return {
      host: this.host,
      players: players
    };
  }

  allPlayersDone() {
    let done = true;
    this.engines.forEach((engine) => {
      if (engine.isRunning) {
        done = false
      } else if (engine.pieceNb != 0) {
        engine.reset()
      }
    });
    if (done) {
      this.io.to(this.name).emit('allPlayersDone', true)
      this.isRunning = false;
    }
    return done;
  }

  playersStillPlaying() {
    let left = 0;
    this.engines.forEach((engine) => {
      if (engine.isRunning) {
        left++;
      }
    });
    return left;
  }

  lastPlayerSocketId() {
    let socketId;
    this.engines.forEach((engine) => {
      if (engine.isRunning) {
        socketId = engine.socketId
      }
    });
    return socketId;
  }

  startGames() {
    this.io.to(this.name).emit('allPlayersDone', false)
    this.engines.forEach((engine) => {
      engine.start()
    })
    this.isRunning = true;
  }
}

export function roomExists(io, roomName) {
    return io.sockets.adapter.rooms.has(roomName)
  }