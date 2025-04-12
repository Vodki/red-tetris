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

        socket.emit('newRoomResponse', {
          correlationId: data.correlationId,
          exist: result
        })
        if (result == false) {
          const room = new Room(data.roomName, socket.id)
          const engine = new GameEngine(socket)
          engine.username = players.get(socket.id)
          room.engines.set(engine.socketId, engine)
          rooms.set(room.name, room)
          socket.join(data.roomName)
        }
      } catch (error) {
        socket.emit('Error', {
          correlationId: data.correlationId,
          error: error.message
        });
      }
    
      
    })
    socket.on('joinRoom', (data) => {
      if (!roomExists(io, data.roomName)) {
        console.log('I didnt find the room:', data.roomName)
        socket.emit('Error', `Room ${data.roomName} doesn't exist`)
      } else {
        const room = rooms.get(data.roomName)
        const engine = new GameEngine(socket)
        room.engines.set(socket.id, engine)
        socket.join(data.roomName)
        socket.emit('joinRoomResponse', {
          correlationId: data.correlationId,
          exist: true,
        })
        socket.to(data.roomName).emit(`${players}`)
      }
  //    socket.onAny((eventName, ...args) => {
  //      console.log(`⬅️ Received from ${socket.id}:`, eventName, args);
  //    });
  //    socket.onAnyOutgoing((eventName, ...args) => {
  //      console.log(`➡️ Sending to ${socket.id}:`, eventName, args);
  //    });
  })
  
  });

  io.on('newSession', (name) => {

  })

  io.on('new-game', () => {
    engine.newGame();
    console.log('NEW GAME RECU')
  });

  io.on('start', () => {
    console.log('START RECEIVED')
  })

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});