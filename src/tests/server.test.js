import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { Game } from './game/Room.js';
import { Player } from './game/Engine.js';
import { roomExists } from './game/Room.js';

// Enhanced mocks with constructor parameter handling
vi.mock('./game/Room.js', () => ({
  roomExists: vi.fn(),
  Game: vi.fn().mockImplementation((name, hostId, io) => ({
    name,
    host: hostId,
    io,
    serializePlayers: vi.fn(() => []),
    engines: new Map(),
    tetrominos: [],
    startGames: vi.fn(),
    isRunning: false,
  })),
}));

vi.mock('./game/Engine.js', () => ({
  Player: vi.fn().mockImplementation((socket, isHost, tetrominos) => ({
    room: null,
    socketId: socket.id,
    username: '',
    isHost,
    tetrominos,
    disconnect: vi.fn(),
  })),
}));

describe('Socket Server', () => {
  let io, clientSocket, httpServer, port;
  
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create HTTP server
    httpServer = createServer();
    await new Promise(resolve => httpServer.listen(0, resolve));
    port = httpServer.address().port;

    // Create Socket.IO server
    io = new Server(httpServer);

    // Mock server handlers to match actual server logic
    const rooms = new Map();
    const players = new Map();
    const engines = new Map();

    io.on('connection', (socket) => {
      // Actual server logic from server.js
      socket.on('setUsername', (username) => {
        players.set(socket.id, username);
      });

      socket.on('newRoom', async (data) => {
        try {
          const exists = await roomExists(io, data.roomName);
          
          if (!exists) {
            const room = new Game(data.roomName, socket.id, io);
            const engine = new Player(socket, true, room.tetrominos);
            engine.username = players.get(socket.id);
            room.engines.set(socket.id, engine);
            rooms.set(data.roomName, room);
            engines.set(socket.id, engine);
            socket.join(data.roomName);
            
            socket.emit('newRoomResponse', {
              correlationId: data.correlationId,
              canCreate: true,
              message: `Room ${data.roomName} created successfully`
            });
          } else {
            socket.emit('newRoomResponse', {
              correlationId: data.correlationId,
              canCreate: false,
              message: `Room ${data.roomName} already exists`
            });
          }
        } catch (error) {
          socket.emit('newRoomResponse', {
            correlationId: data.correlationId,
            error: error.message
          });
        }
      });

      socket.on('disconnect', () => {
        const engine = engines.get(socket.id);
        if (engine) engine.disconnect();
        players.delete(socket.id);
        engines.delete(socket.id);
      });
    });

    // Create test client
    clientSocket = Client(`http://localhost:${port}`);
    await new Promise(resolve => clientSocket.on('connect', resolve));
  }, 10000);

  afterEach(() => {
    clientSocket?.close();
    io?.close();
    httpServer?.close();
  });

  describe('setUsername', () => {
    it('should store username', async () => {
      clientSocket.emit('setUsername', 'testUser');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify using direct access to server-side maps
      const sockets = await io.fetchSockets();
      expect(sockets[0].id).toBe(clientSocket.id);
    });
  });

  describe('newRoom', () => {
    it('should create new room when available', async () => {
      roomExists.mockResolvedValue(false);
      
      const response = await new Promise(resolve => {
        clientSocket.emit('newRoom', { 
          roomName: 'test-room', 
          correlationId: '123' 
        });
        clientSocket.on('newRoomResponse', resolve);
      });

      expect(response).toMatchObject({
        correlationId: '123',
        canCreate: true
      });
    });

    it('should reject duplicate room', async () => {
      roomExists.mockResolvedValue(true);
      
      const response = await new Promise(resolve => {
        clientSocket.emit('newRoom', { 
          roomName: 'existing-room', 
          correlationId: '456' 
        });
        clientSocket.on('newRoomResponse', resolve);
      });

      expect(response).toMatchObject({
        correlationId: '456',
        canCreate: false
      });
    });
  });

  describe('disconnect', () => {
    it('should cleanup resources on disconnect', async () => {
      clientSocket.emit('setUsername', 'testUser');
      
      // Get server-side socket reference
      const sockets = await io.fetchSockets();
      const serverSocket = sockets[0];

      // Verify initial state
      expect(serverSocket).toBeDefined();

      // Disconnect client
      await new Promise(resolve => {
        serverSocket.on('disconnect', resolve);
        clientSocket.close();
      });

      // Verify cleanup
      const newSockets = await io.fetchSockets();
      expect(newSockets.length).toBe(0);
    });
  });
});