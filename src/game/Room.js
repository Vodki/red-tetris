import { newRandomTetromino } from "./Tetromino.js";

export class Room {
  constructor(name, host) {
    this.name = name;
    this.engines = new Map();
    this.host = host
    this.isRunning = false
    this.tetrominos = [];
    this.tetrominos.push(newRandomTetromino());
    this.tetrominos.push(newRandomTetromino());
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

  startGames() {
    this.engines.forEach((engine) => {
      engine.start()
    })
  }
}

export function roomExists(io, roomName) {
    console.log(io.sockets.adapter.rooms)
    return io.sockets.adapter.rooms.has(roomName)
  }