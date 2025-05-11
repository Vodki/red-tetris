import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { Player } from "./game/Engine.js";
import { roomExists, Game } from "./game/Room.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "red-tetris-iota.vercel.app";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

export async function createServerInstance() {
  await app.prepare();
  const httpServer = createServer(handler);
  const io = new Server(httpServer);
  const state = {
    rooms: new Map(),
    players: new Map(),
    engines: new Map()
  };

  io.on("connection", (socket) => {

    socket.on('setUsername', (data) => {
      state.players.set(socket.id, data)
    })

    socket.on('newRoom', async (data) => {
      try {
        const result = await roomExists(io, data.roomName)

        if (result == false) {
          const room = new Game(data.roomName, socket.id, io)
          const engine = new Player(socket, true, room.tetrominos)
          state.engines.set(socket.id, engine)
          engine.room = room
          engine.username = state.players.get(socket.id)
          room.engines.set(engine.socketId, engine)
          state.rooms.set(room.name, room)
          socket.join(data.roomName)
          socket.emit('newRoomResponse', {
            correlationId: data.correlationId,
            canCreate: true,
            message: `Room ${data.roomName} created successfully`
          })
          io.to(data.roomName).emit('roomUpdate', room.serializePlayers())
        } else {
          socket.emit('newRoomResponse', {
            correlationId: data.correlationId,
            canCreate: false,
            message: `Room ${data.roomName} already exist`
          })
        }
      } catch (error) {
        socket.emit('newRoomResponse', {
          correlationId: data.correlationId,
          error: error.message
        });
      }
    })

    socket.on('leaveRoom', (data) => {
      const room = state.rooms.get(data)
      if (room == null) {
        return;
      } else {
        const engine = state.engines.get(socket.id)
        engine.disconnect()
      }
    })

    socket.on('disconnect', () => {
      state.players.delete(socket.id)
      const engine = state.engines.get(socket.id)
      if (engine == null) {
        return;
      } else {
        engine.disconnect()
      }
    })

    socket.on('start', (data) => {
      const room = state.rooms.get(data)
      if (!room || !room.host) {
        socket.emit('sendError', 'Room not found')
        return;
      }
      if (room.host != socket.id) {
        return
      }
      room.startGames()
    })

    socket.on('joinRoom', async (data) => {
      try {
        const result = await roomExists(io, data.roomName)
        if (result == false) {
          socket.emit('joinRoomResponse', {
            correlationId: data.correlationId,
            canJoin: false,
            message: "Room doesn't exist",
          })
        } else if (state.rooms.get(data.roomName).engines.size == 4) {
          socket.emit('joinRoomResponse', {
            correlationId: data.correlationId,
            canJoin: false,
            message: "Room is full",
          })
        } else if (state.rooms.get(data.roomName).isRunning) {
          socket.emit('joinRoomResponse', {
            correlationId: data.correlationId,
            canJoin: false,
            message: "A game is running, please wait for the end",
          })
        } else {
          const room = state.rooms.get(data.roomName)
          const engine = new Player(socket, false, room.tetrominos)
          engine.username = state.players.get(socket.id)
          room.engines.set(socket.id, engine)
          engine.room = room
          state.engines.set(socket.id, engine)
          socket.join(data.roomName)
          socket.emit('joinRoomResponse', {
            correlationId: data.correlationId,
            canJoin: true,
          })
          socket.to(data.roomName).emit(`${state.players.get(socket.id)} joins the game`)
          io.to(data.roomName).emit('roomUpdate', room.serializePlayers())

        }
      } catch (error) {
        socket.emit('joinRoomResponse', {
          correlationId: data.correlationId,
          error: error.message,
        })
      }
    })

  });

  return {
    httpServer,
    io,
    ...state
  };
};

if (process.env.NODE_TEST !== "true") {
  createServerInstance().then(({ httpServer }) => {
    httpServer.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  });
}