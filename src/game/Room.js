export class Room {
  constructor(name, master) {
    this.name = name;
    this.engines = new Map();
    this.master = master
  }
}

export function roomExists(io, roomName) {
    console.log(io.sockets.adapter.rooms)
    return io.sockets.adapter.rooms.has(roomName)
  }