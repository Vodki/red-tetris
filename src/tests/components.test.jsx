import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GameStats from '../components/GameStats';
import Grid from '../components/Grid';
import Leaderboard from '../components/Leaderboard';
import NextPiece from '../components/NextPiece';
import Spectrum from '../components/Spectrum';
import { ToastProvider, useToast } from '../components/ui/toast';
import { createEmptyGrid } from '../utils/gridUtils';
import { cn } from '../lib/utils';

describe('createEmptyGrid', () => {
  it('builds the default 20x10 grid of zeroes', () => {
    const grid = createEmptyGrid();
    expect(grid).toHaveLength(20);
    grid.forEach((row) => {
      expect(row).toHaveLength(10);
      row.forEach((cell) => expect(cell).toBe(0));
    });
  });

  it('accepts custom dimensions and gives independent rows', () => {
    const grid = createEmptyGrid(2, 3);
    grid[0][0] = 1;
    expect(grid[1][0]).toBe(0);
    expect(grid).toHaveLength(2);
  });
});

describe('cn', () => {
  it('merges class names, last tailwind utility wins', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn(null, undefined, false, 'baz')).toBe('baz');
  });
});

describe('Grid', () => {
  it('renders one div per cell, with no table', () => {
    const { container } = render(<Grid grid={createEmptyGrid(3, 4)} />);
    expect(container.querySelectorAll('.row')).toHaveLength(3);
    expect(container.querySelectorAll('.cell')).toHaveLength(12);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('colours the filled cells after their value', () => {
    const { container } = render(<Grid grid={[[0, 5]]} />);
    const cells = container.querySelectorAll('.cell');
    expect(cells[0].className).not.toContain('color-');
    expect(cells[1].className).toContain('color-5');
  });

  it('survives an empty grid', () => {
    const { container } = render(<Grid />);
    expect(container.querySelectorAll('.row')).toHaveLength(0);
  });
});

describe('Spectrum', () => {
  it('draws each column up to the height it was given', () => {
    const { container } = render(<Spectrum spectrum={[0, 2]} rows={3} />);
    const filled = container.querySelectorAll('.spectrum-cell-filled');
    expect(filled).toHaveLength(2);
    expect(container.querySelectorAll('.spectrum-row')).toHaveLength(3);
  });

  it('falls back on an empty ten column spectrum', () => {
    const { container } = render(<Spectrum />);
    expect(container.querySelectorAll('.spectrum-cell-filled')).toHaveLength(0);
    expect(container.querySelectorAll('.spectrum-row')).toHaveLength(20);
  });
});

describe('NextPiece', () => {
  it('previews the shape it is handed', () => {
    const piece = {
      id: 'O',
      color: 4,
      shape: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    };
    const { container } = render(<NextPiece piece={piece} />);

    expect(container.querySelectorAll('.next-piece-cell')).toHaveLength(16);
    expect(container.querySelectorAll('.color-4')).toHaveLength(4);
    expect(screen.getByText('Next')).toBeDefined();
  });

  it('renders an empty box without a piece', () => {
    const { container } = render(<NextPiece />);
    expect(container.querySelectorAll('.next-piece-cell')).toHaveLength(16);
    expect(container.querySelectorAll('[class*="color-"]')).toHaveLength(0);
  });
});

describe('GameStats', () => {
  it('shows the score, the level and the lines', () => {
    render(<GameStats score={1200} level={3} lines={17} username="Alice" />);
    expect(screen.getByText('1200')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('17')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('defaults to a fresh game', () => {
    render(<GameStats />);
    // Score and lines both start at zero, the level at one.
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText('1')).toBeDefined();
  });
});

describe('Leaderboard', () => {
  it('lists the persisted scores in order', () => {
    render(
      <Leaderboard
        entries={[
          { username: 'Alice', score: 900, date: 'a' },
          { username: 'Bob', score: 300, date: 'b' },
        ]}
      />
    );

    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('900')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('says so when nothing was recorded yet', () => {
    render(<Leaderboard />);
    expect(screen.getByText('No score recorded yet.')).toBeDefined();
  });
});

describe('ToastProvider', () => {
  const Probe = () => {
    const toast = useToast();
    return (
      <div>
        <button type="button" onClick={() => toast.error('boom')}>
          error
        </button>
        <button type="button" onClick={() => toast.success('yay')}>
          success
        </button>
        <button type="button" onClick={() => toast.notify('')}>
          empty
        </button>
      </div>
    );
  };

  it('shows and dismisses notifications without any SVG', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    await user.click(screen.getByText('error'));
    expect(screen.getByText('boom')).toBeDefined();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.toast-error')).not.toBeNull();

    await user.click(screen.getByText('success'));
    expect(screen.getByText('yay')).toBeDefined();

    await user.click(screen.getByText('boom'));
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('ignores empty messages', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    await user.click(screen.getByText('empty'));
    expect(container.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('auto-dismisses after the given delay', async () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <ToastProvider duration={1000}>
          <Probe />
        </ToastProvider>
      );

      act(() => screen.getByText('error').click());
      expect(container.querySelectorAll('.toast')).toHaveLength(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200);
      });
      expect(container.querySelectorAll('.toast')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is a no-op outside of a provider', async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByText('error'));
    expect(screen.queryByText('boom')).toBeNull();
  });
});
