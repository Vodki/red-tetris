import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { Scoreboard } from './game/Scores.js';
import { createState, registerHandlers } from './socket/handlers.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = Number.parseInt(process.env.PORT, 10) || 3000;

/**
 * HTTP + socket.io server.
 *
 * Next.js serves `index.html`, the JS bundles and every static asset over HTTP;
 * socket.io carries the bi-directional game events on the same port.
 */
export async function createServerInstance() {
  const app = next({ dev, hostname, port });
  await app.prepare();

  const handler = app.getRequestHandler();
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? ['http://localhost:3000', 'http://0.0.0.0:3000'] : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  const scoreboard = new Scoreboard();
  await scoreboard.load();

  const state = createState();
  registerHandlers(io, state, { scoreboard });

  return { httpServer, io, scoreboard, ...state };
}

if (process.env.NODE_TEST !== 'true') {
  createServerInstance().then(({ httpServer }) => {
    httpServer.listen(port, hostname, () => {
      console.log(`> Red Tetris ready on http://${hostname}:${port}`);
    });
  });
}
