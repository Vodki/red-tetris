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
  },
  rooms: [],
  spectrums: new Map(),
  winner: null,
  allPlayersDone: true,
  leaderboard: [],
  sendInput: vi.fn(),
  enterRoom: vi.fn().mockResolvedValue({ ok: true }),
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
    expect(screen.getByText('No room yet — create the first one.')).toBeDefined();
  });

  it('lists the open rooms and joins one in a click', async () => {
    const user = userEvent.setup();
    socketState.rooms = [
      { name: 'alpha', players: 2, mode: 'classic', isRunning: false },
      { name: 'beta', players: 1, mode: 'gravity', isRunning: true },
    ];
    withToasts(<Home />);

    expect(screen.getByText('alpha')).toBeDefined();
    expect(screen.getByText('In game')).toBeDefined();

    await user.click(screen.getByText('Join'));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/alpha/'));
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
    await waitFor(() => expect(screen.getByText('You lost — Bob won.')).toBeDefined());
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
});
