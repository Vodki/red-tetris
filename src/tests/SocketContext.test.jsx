import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A fake socket.io client we can drive from the tests. */
const makeFakeSocket = () => {
  const handlers = new Map();
  return {
    id: 'me',
    connected: true,
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    on(event, handler) {
      handlers.set(event, handler);
    },
    fire(event, payload) {
      const handler = handlers.get(event);
      if (handler) act(() => handler(payload));
    },
  };
};

let fakeSocket;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

const {
  SocketProvider,
  useSocket,
  initialGame,
  initialRoom,
  resolveSocketUrl,
  REQUEST_TIMEOUT,
  MAX_MESSAGES,
} = await import('../context/SocketContext.jsx');
const { ToastProvider } = await import('../components/ui/toast.jsx');

let api;

const Probe = () => {
  api = useSocket();
  return (
    <div>
      <span data-testid="score">{api.game.score}</span>
      <span data-testid="host">{String(api.room.host)}</span>
      <span data-testid="connected">{String(api.connected)}</span>
      <span data-testid="rooms">{api.rooms.length}</span>
      <span data-testid="spectrums">{api.spectrums.size}</span>
      <span data-testid="done">{String(api.allPlayersDone)}</span>
      <span data-testid="winner">{api.winner ? api.winner.username : ''}</span>
      <span data-testid="board">{api.leaderboard.length}</span>
      <span data-testid="messages">{api.messages.length}</span>
      <span data-testid="spectating">{String(api.spectating)}</span>
      <span data-testid="closed">{String(api.roomClosed)}</span>
    </div>
  );
};

const mount = () =>
  render(
    <ToastProvider>
      <SocketProvider>
        <Probe />
      </SocketProvider>
    </ToastProvider>
  );

beforeEach(() => {
  fakeSocket = makeFakeSocket();
  api = null;
});

describe('initial state', () => {
  it('starts on an empty 20x10 grid', () => {
    const game = initialGame();
    expect(game.grid).toHaveLength(20);
    expect(game.grid[0]).toHaveLength(10);
    expect(game.score).toBe(0);
    expect(game.running).toBe(false);
  });

  it('starts with no room and the classic mode', () => {
    expect(initialRoom()).toEqual({
      name: '',
      host: null,
      mode: 'classic',
      isRunning: false,
      players: [],
      spectators: [],
    });
  });

  it('resolves the socket URL from the window origin', () => {
    expect(resolveSocketUrl()).toBe(window.location.origin);
    expect(REQUEST_TIMEOUT).toBeGreaterThan(0);
  });
});

describe('SocketProvider', () => {
  it('tracks the connection state', async () => {
    mount();
    fakeSocket.fire('connect');
    await waitFor(() => expect(screen.getByTestId('connected').textContent).toBe('true'));

    fakeSocket.fire('disconnect');
    await waitFor(() => expect(screen.getByTestId('connected').textContent).toBe('false'));
  });

  it('mirrors the server game state', async () => {
    mount();
    fakeSocket.fire('GameUpdate', { score: 750, level: 2, running: true });
    await waitFor(() => expect(screen.getByTestId('score').textContent).toBe('750'));
    expect(api.game.level).toBe(2);
  });

  it('collects the opponents spectrums', async () => {
    mount();
    fakeSocket.fire('SpectrumUpdate', { socketId: 'p2', spectrum: [1, 2], score: 10 });
    await waitFor(() => expect(screen.getByTestId('spectrums').textContent).toBe('1'));
    expect(api.spectrums.get('p2').spectrum).toEqual([1, 2]);
  });

  it('mirrors the room, the room list and the end of round', async () => {
    mount();
    fakeSocket.fire('roomUpdate', { host: 'host-1', players: [], mode: 'gravity' });
    fakeSocket.fire('roomList', [{ name: 'lobby' }]);
    fakeSocket.fire('allPlayersDone', true);

    await waitFor(() => expect(screen.getByTestId('host').textContent).toBe('host-1'));
    expect(screen.getByTestId('rooms').textContent).toBe('1');
    expect(screen.getByTestId('done').textContent).toBe('true');
  });

  it('ignores a room list that is not a list', async () => {
    mount();
    fakeSocket.fire('roomList', 'nonsense');
    await waitFor(() => expect(screen.getByTestId('rooms').textContent).toBe('0'));
  });

  it('remembers the winner and clears it on the next round', async () => {
    mount();
    fakeSocket.fire('Winner', { socketId: 'p2', username: 'Bob' });
    await waitFor(() => expect(screen.getByTestId('winner').textContent).toBe('Bob'));

    fakeSocket.fire('gameStarted', { mode: 'classic' });
    await waitFor(() => expect(screen.getByTestId('winner').textContent).toBe(''));
    expect(api.game.running).toBe(true);
  });

  it('sends fire-and-forget events', () => {
    mount();
    expect(api.sendInput('MoveLeft')).toBe(true);
    expect(fakeSocket.emit).toHaveBeenCalledWith('gameInput', 'MoveLeft');
  });

  it('refuses to send while disconnected', () => {
    mount();
    fakeSocket.connected = false;
    expect(api.sendMessage('anything', 1)).toBe(false);
  });

  it('resolves a request on a successful acknowledgement', async () => {
    mount();
    fakeSocket.emit.mockImplementation((event, payload, ack) => ack({ ok: true, host: 'me' }));

    await act(async () => {
      await expect(api.enterRoom('lobby', 'Alice')).resolves.toMatchObject({ ok: true });
    });
    await waitFor(() => expect(screen.getByTestId('host').textContent).toBe('me'));
  });

  it('rejects a request the server refused', async () => {
    mount();
    fakeSocket.emit.mockImplementation((event, payload, ack) =>
      ack({ ok: false, message: 'This room is full.' })
    );

    await act(async () => {
      await expect(api.enterRoom('lobby', 'Alice')).rejects.toThrow('This room is full.');
    });
  });

  it('rejects a request made while disconnected', async () => {
    mount();
    fakeSocket.connected = false;
    await expect(api.request('enterRoom', {})).rejects.toThrow('Not connected');
  });

  it('times out a request the server never answers', async () => {
    vi.useFakeTimers();
    try {
      mount();
      fakeSocket.emit.mockImplementation(() => {});
      const pending = api.request('enterRoom', {});
      const assertion = expect(pending).rejects.toThrow('did not answer');
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT + 100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a refused start through a toast', async () => {
    mount();
    fakeSocket.emit.mockImplementation((event, payload, ack) =>
      ack({ ok: false, message: 'Only the host can start the game.' })
    );

    await act(async () => {
      await api.startGame('lobby');
    });
    expect(screen.getByText('Only the host can start the game.')).toBeDefined();
  });

  it('reports a refused mode change through a toast', async () => {
    mount();
    fakeSocket.emit.mockImplementation((event, payload, ack) =>
      ack({ ok: false, message: 'Cannot change the mode right now.' })
    );

    await act(async () => {
      await api.setMode('lobby', 'gravity');
    });
    expect(screen.getByText('Cannot change the mode right now.')).toBeDefined();
  });

  it('loads the leaderboard, and tolerates a failure', async () => {
    mount();
    fakeSocket.emit.mockImplementation((event, payload, ack) =>
      ack({ ok: true, entries: [{ username: 'Alice', score: 10 }] })
    );

    await act(async () => {
      await api.refreshLeaderboard();
    });
    await waitFor(() => expect(screen.getByTestId('board').textContent).toBe('1'));

    fakeSocket.emit.mockImplementation((event, payload, ack) => ack({ ok: false }));
    await act(async () => {
      await expect(api.refreshLeaderboard()).resolves.toEqual([]);
    });
  });

  it('clears the local state when leaving a room', async () => {
    mount();
    fakeSocket.fire('SpectrumUpdate', { socketId: 'p2', spectrum: [1] });
    await waitFor(() => expect(screen.getByTestId('spectrums').textContent).toBe('1'));

    act(() => api.leaveRoom('lobby'));

    await waitFor(() => expect(screen.getByTestId('spectrums').textContent).toBe('0'));
    expect(fakeSocket.emit).toHaveBeenCalledWith('leaveRoom', 'lobby');
    expect(screen.getByTestId('host').textContent).toBe('null');
  });

  it('closes the socket when unmounted', () => {
    const { unmount } = mount();
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
    expect(fakeSocket.removeAllListeners).toHaveBeenCalled();
  });

  describe('chat and spectating (bonus)', () => {
    it('collects the chat messages, newest last', async () => {
      mount();
      fakeSocket.fire('chatMessage', { username: 'Bob', text: 'gg', date: '1' });
      fakeSocket.fire('chatMessage', { username: 'Eve', text: 'hi', date: '2' });

      await waitFor(() => expect(screen.getByTestId('messages').textContent).toBe('2'));
      expect(api.messages[1].text).toBe('hi');
    });

    it('caps the scrollback', async () => {
      mount();
      for (let index = 0; index < MAX_MESSAGES + 10; index += 1) {
        fakeSocket.fire('chatMessage', { username: 'Bob', text: `m${index}`, date: String(index) });
      }

      await waitFor(() =>
        expect(screen.getByTestId('messages').textContent).toBe(String(MAX_MESSAGES))
      );
      expect(api.messages[MAX_MESSAGES - 1].text).toBe(`m${MAX_MESSAGES + 9}`);
    });

    it('sends a chat message and swallows a refusal', async () => {
      mount();
      fakeSocket.emit.mockImplementation((event, payload, ack) =>
        ack({ ok: false, message: 'Empty message.' })
      );

      await act(async () => {
        await expect(api.sendChat('  ')).resolves.toBeNull();
      });
      expect(fakeSocket.emit).toHaveBeenCalledWith('chat', { text: '  ' }, expect.any(Function));
    });

    it('takes a spectator seat', async () => {
      mount();
      fakeSocket.emit.mockImplementation((event, payload, ack) =>
        ack({ ok: true, spectating: true, host: 'someone' })
      );

      await act(async () => {
        await expect(api.spectate('lobby', 'Eve')).resolves.toMatchObject({ spectating: true });
      });
      await waitFor(() => expect(screen.getByTestId('spectating').textContent).toBe('true'));
    });

    it('gives the seat up when entering the room as a player', async () => {
      mount();
      fakeSocket.emit.mockImplementation((event, payload, ack) => ack({ ok: true }));

      await act(async () => {
        await api.spectate('lobby', 'Eve');
      });
      await waitFor(() => expect(screen.getByTestId('spectating').textContent).toBe('true'));

      await act(async () => {
        await api.enterRoom('lobby', 'Eve');
      });
      await waitFor(() => expect(screen.getByTestId('spectating').textContent).toBe('false'));
    });

    it('reports a room closed under its audience', async () => {
      mount();
      fakeSocket.emit.mockImplementation((event, payload, ack) => ack({ ok: true }));

      await act(async () => {
        await api.spectate('lobby', 'Eve');
      });
      fakeSocket.fire('roomClosed', { name: 'lobby' });

      await waitFor(() => expect(screen.getByTestId('closed').textContent).toBe('true'));
      expect(screen.getByTestId('spectating').textContent).toBe('false');
    });

    it('carries the refusal reason on the rejected error', async () => {
      mount();
      fakeSocket.emit.mockImplementation((event, payload, ack) =>
        ack({ ok: false, reason: 'running', message: 'A game is already running.' })
      );

      await act(async () => {
        await expect(api.enterRoom('lobby', 'Eve')).rejects.toMatchObject({
          reason: 'running',
        });
      });
    });

    it('drops the conversation when leaving the room', async () => {
      mount();
      fakeSocket.fire('chatMessage', { username: 'Bob', text: 'gg', date: '1' });
      await waitFor(() => expect(screen.getByTestId('messages').textContent).toBe('1'));

      act(() => api.leaveRoom('lobby'));

      await waitFor(() => expect(screen.getByTestId('messages').textContent).toBe('0'));
    });
  });
});
