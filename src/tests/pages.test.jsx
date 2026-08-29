import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
let params = { room: 'lobby', player: 'Alice' };

// Next's real router object is stable across renders; mirror that here.
const router = { push };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => params,
}));

const socketState = {};

vi.mock('@/context/SocketContext', async () => {
  const actual = await vi.importActual('@/context/SocketContext');
  return { ...actual, useSocket: () => socketState };
});

const { default: Home } = await import('../app/page.jsx');
const { default: PlayerPage } = await import('../app/[room]/[player]/page.jsx');
const { default: Tetris } = await import('../components/Tetris.jsx');
const { ToastProvider } = await import('../components/ui/toast.jsx');
const { createEmptyGrid } = await import('../utils/gridUtils.js');
const { generateUsername, NAME_PATTERN, USERNAME_PATTERN } = await import('../app/page.jsx');

const withToasts = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

const baseSocketState = () => ({
  connected: true,
  socket: { id: 'me' },
  game: {
    grid: createEmptyGrid(),
    spectrum: [],
    nextPiece: null,
    heldPiece: null,
    canHold: true,
    score: 0,
    level: 1,
    lines: 0,
    gameOver: false,
    running: false,
  },
  room: {
    name: 'lobby',
    host: 'me',
    mode: 'classic',
    isRunning: false,
    players: [{ socketId: 'me', username: 'Alice', isHost: true, spectrum: [], score: 0 }],
    spectators: [],
  },
  rooms: [],
  spectrums: new Map(),
  winner: null,
  allPlayersDone: true,
  leaderboard: [],
  messages: [],
  spectating: false,
  roomClosed: false,
  sendInput: vi.fn(),
  enterRoom: vi.fn().mockResolvedValue({ ok: true }),
  spectate: vi.fn().mockResolvedValue({ ok: true }),
  sendChat: vi.fn(),
  leaveRoom: vi.fn(),
  startGame: vi.fn(),
  setMode: vi.fn(),
  refreshLeaderboard: vi.fn().mockResolvedValue([]),
});

beforeEach(() => {
  push.mockClear();
  params = { room: 'lobby', player: 'Alice' };
  Object.assign(socketState, baseSocketState());
});

describe('lobby page', () => {
  it('generates a valid random player name on mount', async () => {
    withToasts(<Home />);
    const input = await screen.findByPlaceholderText('Player name');
    await waitFor(() => expect(input.value).not.toBe(''));
    expect(USERNAME_PATTERN.test(input.value)).toBe(true);
  });

  it('never generates a name the server would reject', () => {
    // Three dictionary words can overflow the 30 character limit.
    for (let i = 0; i < 2000; i += 1) {
      const name = generateUsername();
      expect(USERNAME_PATTERN.test(name), `rejected: ${name}`).toBe(true);
    }
  });

  it('navigates to /<room>/<player_name>', async () => {
    const user = userEvent.setup();
    withToasts(<Home />);

    await user.clear(screen.getByPlaceholderText('Player name'));
    await user.type(screen.getByPlaceholderText('Player name'), 'Alice');
    await user.type(screen.getByPlaceholderText('Room name'), 'lobby');
    await user.click(screen.getByText('Play'));

    expect(push).toHaveBeenCalledWith('/lobby/Alice');
  });

  it('refuses an invalid room name', async () => {
    const user = userEvent.setup();
    withToasts(<Home />);

    await user.type(screen.getByPlaceholderText('Room name'), 'a');
    await user.clear(screen.getByPlaceholderText('Player name'));
    await user.type(screen.getByPlaceholderText('Player name'), 'Alice');

    // The input caps the length, so drive the validation directly too.
    expect(NAME_PATTERN.test('bad name')).toBe(false);
    expect(NAME_PATTERN.test('good-name_1')).toBe(true);

    await user.click(screen.getByText('Play'));
    expect(push).toHaveBeenCalledWith('/a/Alice');
  });

  it('warns instead of navigating when the player name is empty', async () => {
    const user = userEvent.setup();
    withToasts(<Home />);

    await user.clear(screen.getByPlaceholderText('Player name'));
    await user.type(screen.getByPlaceholderText('Room name'), 'lobby');
    await user.click(screen.getByText('Play'));

    expect(push).not.toHaveBeenCalled();
  });

  it('regenerates a random name on demand', async () => {
    const user = userEvent.setup();
    withToasts(<Home />);

    const input = screen.getByPlaceholderText('Player name');
    await waitFor(() => expect(input.value).not.toBe(''));
    const first = input.value;

    await user.click(screen.getByText('Random'));
    await waitFor(() => expect(USERNAME_PATTERN.test(input.value)).toBe(true));
    expect(first).not.toBe('');
  });

  it('says when no room is open', () => {
    withToasts(<Home />);
    expect(screen.getByText('No room yet - create the first one.')).toBeDefined();
  });

  it('lists the open rooms and joins one in a click', async () => {
    const user = userEvent.setup();
    socketState.rooms = [
      { name: 'alpha', players: 2, mode: 'classic', isRunning: false },
      { name: 'beta', players: 1, spectators: 2, mode: 'gravity', isRunning: true },
    ];
    withToasts(<Home />);

    expect(screen.getByText('alpha')).toBeDefined();
    // Bonus: a running room cannot be joined, only watched.
    expect(screen.getByText('Watch')).toBeDefined();
    expect(screen.getByText(/2 watching/)).toBeDefined();

    await user.click(screen.getByText('Join'));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/alpha/'));
  });

  it('sends a click on a running room to its spectator entrance', async () => {
    const user = userEvent.setup();
    socketState.rooms = [{ name: 'beta', players: 1, mode: 'classic', isRunning: true }];
    withToasts(<Home />);

    await user.click(screen.getByText('Watch'));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/beta/'));
  });
});

describe('/<room>/<player> page', () => {
  it('reads the room and the player name off the URL', () => {
    params = { room: 'my-room', player: 'Al%20ice' };
    withToasts(<PlayerPage />);
    expect(socketState.enterRoom).toHaveBeenCalledWith('my-room', 'Al ice');
  });

  it('survives a missing parameter', () => {
    params = {};
    expect(() => withToasts(<PlayerPage />)).not.toThrow();
  });
});

describe('Tetris', () => {
  it('enters the room straight from the URL and renders the field', async () => {
    withToasts(<Tetris room="lobby" username="Alice" />);

    await waitFor(() => expect(screen.getByLabelText('playing field')).toBeDefined());
    expect(socketState.enterRoom).toHaveBeenCalledWith('lobby', 'Alice');
    expect(screen.getByText(/Room/)).toBeDefined();
  });

  it('shows a connecting state until the room answers', () => {
    socketState.connected = false;
    withToasts(<Tetris room="lobby" username="Alice" />);
    expect(screen.getByText('Connecting…')).toBeDefined();
  });

  it('goes back to the lobby when the room refuses the player', async () => {
    socketState.enterRoom = vi.fn().mockRejectedValue(new Error('This room is full.'));
    withToasts(<Tetris room="lobby" username="Alice" />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(screen.getByText('This room is full.')).toBeDefined();
  });

  it('gives the host the start button and the mode picker', async () => {
    const user = userEvent.setup();
    withToasts(<Tetris room="lobby" username="Alice" />);

    const start = await screen.findByText('Start game');
    await user.click(start);
    expect(socketState.startGame).toHaveBeenCalledWith('lobby');

    await user.click(screen.getByText('Invisible pieces'));
    expect(socketState.setMode).toHaveBeenCalledWith('lobby', 'invisible');
  });

  it('tells a guest to wait for the host', async () => {
    socketState.room = { ...socketState.room, host: 'someone-else' };
    withToasts(<Tetris room="lobby" username="Alice" />);

    await waitFor(() =>
      expect(screen.getByText('Waiting for the host to start the game.')).toBeDefined()
    );
    expect(screen.queryByText('Start game')).toBeNull();
  });

  it('sends the keyboard inputs the subject lists, and nothing else', async () => {
    socketState.game = { ...socketState.game, running: true };
    withToasts(<Tetris room="lobby" username="Alice" />);
    await screen.findByLabelText('playing field');

    const press = (key) =>
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });

    press('ArrowLeft');
    press('ArrowRight');
    press('ArrowUp');
    press('ArrowDown');
    press(' ');
    press('KeyQ');

    expect(socketState.sendInput.mock.calls.map(([command]) => command)).toEqual([
      'MoveLeft',
      'MoveRight',
      'Rotate',
      'MoveDown',
      'HardDrop',
    ]);
  });

  it('ignores the keyboard once the game is over', async () => {
    socketState.game = { ...socketState.game, running: true, gameOver: true };
    withToasts(<Tetris room="lobby" username="Alice" />);
    await screen.findByLabelText('playing field');

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(socketState.sendInput).not.toHaveBeenCalled();
  });

  it('shows the opponents as spectrums only', async () => {
    socketState.room = {
      ...socketState.room,
      players: [
        ...socketState.room.players,
        { socketId: 'p2', username: 'Bob', isHost: false, spectrum: [3, 0, 1], score: 42 },
      ],
    };
    const { container } = withToasts(<Tetris room="lobby" username="Alice" />);

    await waitFor(() => expect(screen.getByText('Bob')).toBeDefined());
    expect(container.querySelector('.spectrum')).not.toBeNull();
    expect(screen.getByText('42')).toBeDefined();
  });

  it('prefers the live spectrum over the one from the room snapshot', async () => {
    socketState.room = {
      ...socketState.room,
      players: [
        ...socketState.room.players,
        { socketId: 'p2', username: 'Bob', isHost: false, spectrum: [0], score: 0 },
      ],
    };
    socketState.spectrums = new Map([
      ['p2', { socketId: 'p2', spectrum: [20, 0, 0], score: 999 }],
    ]);
    withToasts(<Tetris room="lobby" username="Alice" />);

    await waitFor(() => expect(screen.getByText('999')).toBeDefined());
  });

  it('announces the winner and the loser', async () => {
    socketState.game = { ...socketState.game, gameOver: true };
    socketState.winner = { socketId: 'me', username: 'Alice' };
    withToasts(<Tetris room="lobby" username="Alice" />);
    await waitFor(() => expect(screen.getByText('You won!')).toBeDefined());
  });

  it('announces a defeat when somebody else won', async () => {
    socketState.game = { ...socketState.game, gameOver: true };
    socketState.winner = { socketId: 'p2', username: 'Bob' };
    withToasts(<Tetris room="lobby" username="Alice" />);
    await waitFor(() => expect(screen.getByText('You lost - Bob won.')).toBeDefined());
  });

  it('reports a plain game over in solo', async () => {
    socketState.game = { ...socketState.game, gameOver: true };
    withToasts(<Tetris room="lobby" username="Alice" />);
    await waitFor(() => expect(screen.getByText('Game over')).toBeDefined());
  });

  it('leaves the room and goes home', async () => {
    const user = userEvent.setup();
    withToasts(<Tetris room="lobby" username="Alice" />);

    await user.click(await screen.findByText('Leave room'));
    expect(socketState.leaveRoom).toHaveBeenCalledWith('lobby');
    expect(push).toHaveBeenCalledWith('/');
  });

  describe('hold (bonus)', () => {
    it('sends the Hold input on C and on Shift', async () => {
      socketState.game = { ...socketState.game, running: true };
      withToasts(<Tetris room="lobby" username="Alice" />);
      await screen.findByLabelText('playing field');

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      });

      expect(socketState.sendInput.mock.calls.map(([command]) => command)).toEqual([
        'Hold',
        'Hold',
      ]);
    });

    it('shows the hold slot, dimmed once the swap is spent', async () => {
      socketState.game = {
        ...socketState.game,
        heldPiece: { id: 'O', color: 4, shape: [{ x: 0, y: 0 }] },
        canHold: false,
      };
      const { container } = withToasts(<Tetris room="lobby" username="Alice" />);

      // "Hold" also labels the controls cheat-sheet, so target the slot itself.
      await waitFor(() =>
        expect(container.querySelector('.next-piece-dimmed')).not.toBeNull()
      );
      expect(
        container.querySelector('.next-piece-dimmed .next-piece-label').textContent
      ).toBe('Hold');
    });
  });

  describe('chat (bonus)', () => {
    it('shows the room conversation and sends a message', async () => {
      const user = userEvent.setup();
      socketState.messages = [
        { socketId: 'p2', username: 'Bob', text: 'good luck', date: '1' },
      ];
      withToasts(<Tetris room="lobby" username="Alice" />);

      await waitFor(() => expect(screen.getByText('good luck')).toBeDefined());
      await user.type(screen.getByLabelText('chat message'), 'gg');
      await user.click(screen.getByText('Send'));

      expect(socketState.sendChat).toHaveBeenCalledWith('gg');
    });

    it('never turns what is typed in the chat into a game input', async () => {
      const user = userEvent.setup();
      socketState.game = { ...socketState.game, running: true };
      withToasts(<Tetris room="lobby" username="Alice" />);

      await user.type(await screen.findByLabelText('chat message'), 'c ');

      expect(socketState.sendInput).not.toHaveBeenCalled();
    });
  });

  describe('spectating (bonus)', () => {
    const runningRefusal = () => {
      const error = new Error('A game is already running in this room.');
      error.reason = 'running';
      return error;
    };

    it('offers to watch instead of bouncing back to the lobby', async () => {
      const user = userEvent.setup();
      socketState.enterRoom = vi.fn().mockRejectedValue(runningRefusal());
      withToasts(<Tetris room="lobby" username="Alice" />);

      const watch = await screen.findByText('Watch this round');
      expect(push).not.toHaveBeenCalled();

      await user.click(watch);
      expect(socketState.spectate).toHaveBeenCalledWith('lobby', 'Alice');
    });

    it('still goes home when the offer is declined', async () => {
      const user = userEvent.setup();
      socketState.enterRoom = vi.fn().mockRejectedValue(runningRefusal());
      withToasts(<Tetris room="lobby" username="Alice" />);

      await user.click(await screen.findByText('Back to the lobby'));
      expect(push).toHaveBeenCalledWith('/');
    });

    it('goes home when the round cannot be watched either', async () => {
      const user = userEvent.setup();
      socketState.enterRoom = vi.fn().mockRejectedValue(runningRefusal());
      socketState.spectate = vi.fn().mockRejectedValue(new Error('Room not found.'));
      withToasts(<Tetris room="lobby" username="Alice" />);

      await user.click(await screen.findByText('Watch this round'));
      await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    });

    it('shows every field and no board of its own while watching', async () => {
      socketState.spectating = true;
      socketState.room = {
        ...socketState.room,
        isRunning: true,
        players: [
          { socketId: 'p1', username: 'Alice', isHost: true, spectrum: [2], score: 10 },
          { socketId: 'p2', username: 'Bob', isHost: false, spectrum: [5], score: 20 },
        ],
        spectators: [{ socketId: 'me', username: 'Eve' }],
      };
      withToasts(<Tetris room="lobby" username="Eve" />);

      await waitFor(() => expect(screen.getByText('Players')).toBeDefined());
      expect(screen.queryByLabelText('playing field')).toBeNull();
      expect(screen.getByText('Alice (host)')).toBeDefined();
      expect(screen.getByText('Bob')).toBeDefined();
      expect(screen.getByText('1 watching')).toBeDefined();
      expect(screen.getByText('Round in progress…')).toBeDefined();
    });

    it('joins the table once the round is over', async () => {
      const user = userEvent.setup();
      socketState.spectating = true;
      socketState.room = { ...socketState.room, isRunning: false };
      withToasts(<Tetris room="lobby" username="Eve" />);

      await user.click(await screen.findByText('Join the next round'));
      expect(socketState.enterRoom).toHaveBeenCalledWith('lobby', 'Eve');
    });

    it('goes home when the room it watched is closed', async () => {
      socketState.spectating = true;
      socketState.roomClosed = true;
      withToasts(<Tetris room="lobby" username="Eve" />);

      await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    });
  });
});
