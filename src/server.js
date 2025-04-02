import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { GameEngine } from "./game/Engine.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const games = new Map();

  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log('Client connected:', socket.id)
    const engine = new GameEngine(socket)
    games.set(socket.id, engine);
    socket.emit('Salut mon pote')
    console.log('Websocket Connection Backend')
    engine.on('update', (state) => {
      socket.emit('GameUpdate', state);
    });
//    socket.onAny((eventName, ...args) => {
//      console.log(`⬅️ Received from ${socket.id}:`, eventName, args);
//    });
//    socket.onAnyOutgoing((eventName, ...args) => {
//      console.log(`➡️ Sending to ${socket.id}:`, eventName, args);
//    });
  
  });

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