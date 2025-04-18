import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { io as Client } from 'socket.io-client';
import { createServerInstance } from '../server.js';
import * as RoomModule from '../game/Room.js';
import * as EngineModule from '../game/Engine.js';

vi.mock('../game/Room.js', () => ({
    Game: vi.fn().mockImplementation((name, hostId, io) => ({
        name,
        host: hostId,
        io,
        engines: new Map(),
        tetrominos: [],
        serializePlayers: vi.fn().mockReturnValue([]),
        startGames: vi.fn(),
        isRunning: false,
    })),
    roomExists: vi.fn(),
}));

vi.mock('../game/Engine.js', () => ({
    Player: vi.fn().mockImplementation((socket, isHost, tetrominos) => ({
        socket,
        socketId: socket.id,
        isHost,
        tetrominos,
        room: null,
        username: '',
        disconnect: vi.fn(),
    })),
}));

describe('server.js', () => {
    let server, client1, client2, port;
    const ROOM = 'room1';
    const CID = 'corr-42';

    const roomExistsMock = vi.mocked(RoomModule.roomExists);
    const GameMock = vi.mocked(RoomModule.Game);
    const PlayerMock = vi.mocked(EngineModule.Player);

    beforeEach(async () => {
        server = await createServerInstance();
        await new Promise((r) => server.httpServer.listen(0, r));
        port = server.httpServer.address().port;

        client1 = Client(`http://localhost:${port}`);
        await new Promise((r) => client1.on('connect', r));

        server.players.clear();
        server.rooms.clear();
        server.engines.clear();
        roomExistsMock.mockReset();
        GameMock.mockClear();
        PlayerMock.mockClear();
    });

    afterEach(async () => {
        client1.close();
        if (client2) client2.close();
        await new Promise((r) => server.io.close(r));
        await new Promise((r) => server.httpServer.close(r));
        process.removeAllListeners('unhandledRejection')
        process.removeAllListeners('uncaughtException')
    });

    it('setUsername stores the username in state.players', async () => {
        client1.emit('setUsername', 'alice');
        await new Promise((r) => setTimeout(r, 20));
        expect(server.players.get(client1.id)).toBe('alice');
    });

    describe('newRoom', () => {
        it('success when roomExists → false', async () => {
            roomExistsMock.mockResolvedValueOnce(false);

            client1.emit('setUsername', 'alice');

            const res = await new Promise((r) => {
                client1.emit('newRoom', { roomName: ROOM, correlationId: CID });
                client1.on('newRoomResponse', r);
            });

            expect(res).toEqual({
                correlationId: CID,
                canCreate: true,
                message: `Room ${ROOM} created successfully`,
            });

            expect(server.rooms.has(ROOM)).toBe(true);
            expect(server.engines.size).toBe(1);
            expect(GameMock).toHaveBeenCalledOnce();
            expect(PlayerMock).toHaveBeenCalledOnce();
        });

        it('failure when roomExists → true', async () => {
            roomExistsMock.mockResolvedValueOnce(true);
            client1.emit('setUsername', 'bob');

            const res = await new Promise((r) => {
                client1.emit('newRoom', { roomName: ROOM, correlationId: CID });
                client1.on('newRoomResponse', r);
            });

            expect(res).toEqual({
                correlationId: CID,
                canCreate: false,
                message: `Room ${ROOM} already exist`,
            });
            expect(server.rooms.has(ROOM)).toBe(false);
        });

        it('error in roomExists() is caught and forwarded', async () => {
            roomExistsMock.mockRejectedValueOnce(new Error('boom!'));
            client1.emit('setUsername', 'charlie');

            const res = await new Promise((r) => {
                client1.emit('newRoom', { roomName: ROOM, correlationId: CID });
                client1.on('newRoomResponse', r);
            });

            expect(res).toEqual({
                correlationId: CID,
                error: 'boom!',
            });
            expect(server.rooms.size).toBe(0);
        });
    });

    describe('leaveRoom', () => {
        it('no‐op when room not in state.rooms', async () => {
            client1.emit('leaveRoom', ROOM);
            await new Promise((r) => setTimeout(r, 20));
        });

        it('calls engine.disconnect() when in a room', async () => {
            roomExistsMock.mockResolvedValueOnce(false);
            client1.emit('setUsername', 'dave');
            await new Promise((r) => {
                client1.emit('newRoom', { roomName: ROOM, correlationId: CID });
                client1.on('newRoomResponse', r);
            });

            const engineInstance = PlayerMock.mock.results[0].value;
            client1.emit('leaveRoom', ROOM);
            await new Promise((r) => setTimeout(r, 20));

            expect(engineInstance.disconnect).toHaveBeenCalled();
        });
    });

    describe('disconnect (socket)', () => {
        it('clears state.players and calls engine.disconnect if any', async () => {
            roomExistsMock.mockResolvedValueOnce(false);
            client1.emit('setUsername', 'ellen');
            await new Promise((r) => {
                client1.emit('newRoom', { roomName: ROOM, correlationId: CID });
                client1.on('newRoomResponse', r);
            });
            const engineInstance = PlayerMock.mock.results[0].value;

            client1.close();
            await new Promise((r) => setTimeout(r, 50));

            expect(server.players.has(client1.id)).toBe(false);
            expect(engineInstance.disconnect).toHaveBeenCalled();
        });
    });

    describe('start', () => {
        it('emits sendError if room not found', async () => {
            const err = await new Promise((r) => {
                client1.once('sendError', r);
                client1.emit('start', ROOM);
            });
            expect(err).toBe('Room not found');
        });

        it('does nothing if not the host', async () => {
            roomExistsMock.mockResolvedValueOnce(false);
            client1.emit('setUsername', 'host');
            await new Promise((r) => {
                client1.emit('newRoom', { roomName: ROOM, correlationId: CID });
                client1.on('newRoomResponse', r);
            });

            client2 = Client(`http://localhost:${port}`);
            await new Promise((r) => client2.on('connect', r));
            client2.emit('start', ROOM);
            await new Promise((r) => setTimeout(r, 20));

            const gameInstance = GameMock.mock.results[0].value;
            expect(gameInstance.startGames).not.toHaveBeenCalled();
        });

        it('calls startGames when host invokes start', async () => {
            roomExistsMock.mockResolvedValueOnce(false);
            client1.emit('setUsername', 'host2');
            await new Promise((r) => {
                client1.emit('newRoom', { roomName: ROOM, correlationId: CID });
                client1.on('newRoomResponse', r);
            });

            client1.emit('start', ROOM);
            await new Promise((r) => setTimeout(r, 20));

            const gameInstance = GameMock.mock.results[0].value;
            expect(gameInstance.startGames).toHaveBeenCalled();
        });
    });

    describe('joinRoom', () => {
        beforeEach(async () => {
            roomExistsMock.mockResolvedValueOnce(false);
            client1.emit('setUsername', 'host3');
            await new Promise((r) => {
                client1.emit('newRoom', { roomName: ROOM, correlationId: CID });
                client1.on('newRoomResponse', r);
            });
        });

        it('fails when roomExists → false', async () => {
            roomExistsMock.mockResolvedValueOnce(false);
            client2 = Client(`http://localhost:${port}`);
            await new Promise((r) => client2.on('connect', r));
            client2.emit('setUsername', 'joey');

            const res = await new Promise((r) => {
                client2.emit('joinRoom', { roomName: 'nope', correlationId: CID });
                client2.on('joinRoomResponse', r);
            });
            expect(res).toEqual({
                correlationId: CID,
                canJoin: false,
                message: "Room doesn't exist",
            });
        });

        it('fails when room is full', async () => {
            const room = server.rooms.get(ROOM);
            room.engines.clear();
            ['a', 'b', 'c', 'd'].forEach((id) => room.engines.set(id, {}));

            roomExistsMock.mockResolvedValueOnce(true);
            client2 = Client(`http://localhost:${port}`);
            await new Promise((r) => client2.on('connect', r));
            client2.emit('setUsername', 'max');

            const res = await new Promise((r) => {
                client2.emit('joinRoom', { roomName: ROOM, correlationId: CID });
                client2.on('joinRoomResponse', r);
            });
            expect(res).toEqual({
                correlationId: CID,
                canJoin: false,
                message: "Room is full",
            });
        });

        it('fails when game already running', async () => {
            const room = server.rooms.get(ROOM);
            room.isRunning = true;
            roomExistsMock.mockResolvedValueOnce(true);

            client2 = Client(`http://localhost:${port}`);
            await new Promise((r) => client2.on('connect', r));
            client2.emit('setUsername', 'peter');

            const res = await new Promise((r) => {
                client2.emit('joinRoom', { roomName: ROOM, correlationId: CID });
                client2.on('joinRoomResponse', r);
            });
            expect(res).toEqual({
                correlationId: CID,
                canJoin: false,
                message: "A game is running, please wait for the end",
            });
        });

        it('succeeds when room exists and not full/running', async () => {
            roomExistsMock.mockResolvedValueOnce(true);
            const room = server.rooms.get(ROOM);
            room.isRunning = false;
            room.engines.clear();

            client2 = Client(`http://localhost:${port}`);
            await new Promise((r) => client2.on('connect', r));
            client2.emit('setUsername', 'anna');

            const res = await new Promise((r) => {
                client2.emit('joinRoom', { roomName: ROOM, correlationId: CID });
                client2.on('joinRoomResponse', r);
            });
            expect(res).toEqual({
                correlationId: CID,
                canJoin: true,
            });
            expect(server.engines.size).toBe(2);
        });

        it('forwards errors thrown by roomExists()', async () => {
            roomExistsMock.mockRejectedValueOnce(new Error('ouch'));
            client2 = Client(`http://localhost:${port}`);
            await new Promise((r) => client2.on('connect', r));
            client2.emit('setUsername', 'errorCase');

            const res = await new Promise((r) => {
                client2.emit('joinRoom', { roomName: ROOM, correlationId: CID });
                client2.on('joinRoomResponse', r);
            });
            expect(res).toEqual({
                correlationId: CID,
                error: 'ouch',
            });
        });
    });
});
