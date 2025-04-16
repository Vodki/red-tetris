import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { GameEngine } from "./game/Engine.js";
import { roomExists, Room } from "./game/Room.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const rooms = new Map();
  const players = new Map();
  const engines = new Map();
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log('Client connected:', socket.id);
    //const engine = new GameEngine(socket)
    //sessions.set(socket.id, engine);
    //socket.emit('Salut mon pote')
    console.log('Websocket Connection Backend');
//    engine.on('update', (state) => {
//      socket.emit('GameUpdate', state);
//    });

    socket.on('setUsername', (data) => {
      players.set(socket.id, data)
    })

    socket.on('newRoom', async (data) => {
      try {
        const result = await roomExists(io, data.roomName)
        console.log('room exist =', result)

        if (result == false) {
          const room = new Room(data.roomName, socket.id, io)
          const engine = new GameEngine(socket, true, room.tetrominos)
          engines.set(socket.id, engine)
          engine.room = room
          engine.username = players.get(socket.id)
          room.engines.set(engine.socketId, engine)
          rooms.set(room.name, room)
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

    socket.on('disconnect', () => {
      players.delete(socket.id)
      const engine = engines.get(socket.id)
      if (engine == null) {
        return;
      } else {
        engine.disconnect()
      }
      console.log('Client disconnected')
    })

    socket.on('start', (data) => {
      const room = rooms.get(data)
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
        } else if(rooms.get(data.roomName).engines.size == 4) {
          socket.emit('joinRoomResponse', {
            correlationId: data.correlationId,
            canJoin: false,
            message: "Room is full",
          })
        } else {
          const room = rooms.get(data.roomName)
          const engine = new GameEngine(socket, false, room.tetrominos)
          engine.username = players.get(socket.id)
          room.engines.set(socket.id, engine)
          engine.room = room
          engines.set(socket.id, engine)
          socket.join(data.roomName)
          socket.emit('joinRoomResponse', {
            correlationId: data.correlationId,
            canJoin: true,
          })
          socket.to(data.roomName).emit(`${players.get(socket.id)} joins the game`)
          io.to(data.roomName).emit('roomUpdate', room.serializePlayers())

        }
     } catch (error) {
      socket.emit('joinRoomResponse', {
        correlationId: data.correlationId,
        error: error.message,
      })
     }
     socket.onAny((eventName, ...args) => {
       console.log(`⬅️ Received from ${socket.id}:`, eventName, args);
     });
  //    socket.onAnyOutgoing((eventName, ...args) => {
  //      console.log(`➡️ Sending to ${socket.id}:`, eventName, args);
  //    });
  })
  
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});