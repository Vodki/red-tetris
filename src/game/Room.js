import { newRandomTetromino } from "./Tetromino.js";

export class Room {
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
        socketId: engine.socketId
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
    }
    return done;
  }

  startGames() {
    this.io.to(this.name).emit('allPlayersDone', false)
    this.engines.forEach((engine) => {
      engine.start()
    })
  }
}

export function roomExists(io, roomName) {
    return io.sockets.adapter.rooms.has(roomName)
  }