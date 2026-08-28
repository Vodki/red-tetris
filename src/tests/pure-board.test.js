import { describe, expect, it } from 'vitest';
import {
  COLS,
  EMPTY,
  GHOST,
  PENALTY,
  ROWS,
  addPenaltyLines,
  cellAt,
  clearFullLines,
  columnHeight,
  computeSpectrum,
  copyGrid,
  createGrid,
  dropDistance,
  fullLineIndexes,
  ghostBlocks,
  gridWidth,
  hidePile,
  isInside,
  isLineEmpty,
  isLineFull,
  isValidPosition,
  lockBlocks,
  paint,
  renderGrid,
  spectrumToGrid,
} from '../game/pure/board.js';

const filledRow = (value = 1) => Array(COLS).fill(value);

describe('pure/board', () => {
  it('creates an empty 20x10 field', () => {
    const grid = createGrid();
    expect(grid).toHaveLength(ROWS);
    expect(gridWidth(grid)).toBe(COLS);
    expect(grid.every((row) => row.every((cell) => cell === EMPTY))).toBe(true);
  });

  it('createGrid accepts custom dimensions', () => {
    expect(createGrid(2, 3)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('copyGrid is a deep copy', () => {
    const grid = createGrid(2, 2);
    const copy = copyGrid(grid);
    copy[0][0] = 5;
    expect(grid[0][0]).toBe(EMPTY);
  });

  it('isInside and cellAt guard the boundaries', () => {
    const grid = createGrid(2, 2);
    expect(isInside(grid, 0, 0)).toBe(true);
    expect(isInside(grid, -1, 0)).toBe(false);
    expect(isInside(grid, 0, 5)).toBe(false);
    expect(cellAt(grid, 99, 99)).toBe(EMPTY);
  });

  it('recognises full and empty lines', () => {
    const grid = [filledRow(3), Array(COLS).fill(EMPTY), filledRow(PENALTY)];
    expect(isLineFull(grid, 0)).toBe(true);
    expect(isLineEmpty(grid, 1)).toBe(true);
    // Penalty lines are indestructible: they are never "full".
    expect(isLineFull(grid, 2)).toBe(false);
  });

  it('validates positions against walls, floor and pile', () => {
    const grid = createGrid();
    expect(isValidPosition(grid, [{ x: 0, y: 0 }])).toBe(true);
    expect(isValidPosition(grid, [{ x: -1, y: 0 }])).toBe(false);
    expect(isValidPosition(grid, [{ x: COLS, y: 0 }])).toBe(false);
    expect(isValidPosition(grid, [{ x: 0, y: ROWS }])).toBe(false);
    // Above the ceiling is allowed, a piece may spawn partly off-screen.
    expect(isValidPosition(grid, [{ x: 0, y: -3 }])).toBe(true);

    const occupied = lockBlocks(grid, [{ x: 4, y: 10 }], 2);
    expect(isValidPosition(occupied, [{ x: 4, y: 10 }])).toBe(false);
  });

  it('paint and lockBlocks never mutate the source grid', () => {
    const grid = createGrid();
    const painted = paint(grid, [{ x: 1, y: 1 }], 7);
    expect(painted[1][1]).toBe(7);
    expect(grid[1][1]).toBe(EMPTY);
    expect(lockBlocks(grid, [{ x: 9, y: 19 }], 4)[19][9]).toBe(4);
    expect(grid[19][9]).toBe(EMPTY);
  });

  it('paint ignores blocks outside the grid', () => {
    const grid = createGrid(2, 2);
    expect(paint(grid, [{ x: 9, y: 9 }], 1)).toEqual(grid);
  });

  it('clears complete lines and drops the rows above', () => {
    const grid = createGrid();
    const marked = paint(grid, [{ x: 0, y: 17 }], 6);
    const withFull = marked.map((row, y) => (y === 19 ? filledRow(2) : row));

    const { grid: cleared, cleared: count } = clearFullLines(withFull);
    expect(count).toBe(1);
    expect(cleared).toHaveLength(ROWS);
    expect(cleared[18][0]).toBe(6);
    expect(isLineEmpty(cleared, 0)).toBe(true);
  });

  it('clears several non-adjacent lines at once', () => {
    const grid = createGrid().map((row, y) =>
      y === 15 || y === 19 ? filledRow(1) : row
    );
    const { cleared } = clearFullLines(grid);
    expect(cleared).toBe(2);
    expect(fullLineIndexes(grid)).toEqual([15, 19]);
  });

  it('returns the grid untouched when nothing is complete', () => {
    const grid = createGrid();
    const result = clearFullLines(grid);
    expect(result.cleared).toBe(0);
    expect(result.grid).toBe(grid);
  });

  it('adds indestructible penalty lines at the bottom', () => {
    const { grid, toppedOut } = addPenaltyLines(createGrid(), 2);
    expect(toppedOut).toBe(false);
    expect(grid).toHaveLength(ROWS);
    expect(grid[18]).toEqual(filledRow(PENALTY));
    expect(grid[19]).toEqual(filledRow(PENALTY));
    expect(clearFullLines(grid).cleared).toBe(0);
  });

  it('reports a top-out when blocks are pushed past the ceiling', () => {
    const grid = paint(createGrid(), [{ x: 3, y: 0 }], 5);
    expect(addPenaltyLines(grid, 1).toppedOut).toBe(true);
    expect(addPenaltyLines(grid, 0)).toEqual({ grid, toppedOut: false });
  });

  it('caps the penalty at the height of the field', () => {
    const { grid } = addPenaltyLines(createGrid(), 999);
    expect(grid).toHaveLength(ROWS);
    expect(grid.every((row) => row.every((cell) => cell === PENALTY))).toBe(true);
  });

  it('computes the spectrum as the height of each column', () => {
    const grid = paint(createGrid(), [{ x: 0, y: 19 }, { x: 2, y: 5 }], 1);
    expect(columnHeight(grid, 0)).toBe(1);
    expect(columnHeight(grid, 1)).toBe(0);
    expect(columnHeight(grid, 2)).toBe(15);
    expect(computeSpectrum(grid)).toEqual([1, 0, 15, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('spectrumToGrid rebuilds a displayable column chart', () => {
    const grid = spectrumToGrid([0, 2], 3);
    expect(grid).toEqual([
      [0, 0],
      [0, 1],
      [0, 1],
    ]);
  });

  it('computes the drop distance and the ghost position', () => {
    const grid = createGrid();
    expect(dropDistance(grid, [{ x: 0, y: 0 }])).toBe(19);
    expect(ghostBlocks(grid, [{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 19 }]);

    const pile = paint(grid, [{ x: 0, y: 10 }], 3);
    expect(dropDistance(pile, [{ x: 0, y: 0 }])).toBe(9);
  });

  it('renders the pile, the ghost and the falling piece', () => {
    const grid = createGrid();
    const rendered = renderGrid(grid, [{ x: 0, y: 0 }], 5);
    expect(rendered[0][0]).toBe(5);
    expect(rendered[19][0]).toBe(GHOST);
  });

  it('can render without the landing preview', () => {
    const rendered = renderGrid(createGrid(), [{ x: 0, y: 0 }], 5, { showGhost: false });
    expect(rendered[19][0]).toBe(EMPTY);
  });

  it('the invisible mode hides the pile but keeps the penalty lines', () => {
    const withPile = paint(createGrid(), [{ x: 0, y: 18 }], 4);
    const { grid: withPenalty } = addPenaltyLines(withPile, 1);

    expect(hidePile(withPenalty)[19][0]).toBe(PENALTY);

    const rendered = renderGrid(withPenalty, [{ x: 5, y: 0 }], 2, { invisible: true });
    expect(rendered[5 - 5][5]).toBe(2);
    expect(rendered[19][0]).toBe(PENALTY);
    expect(rendered[17][0]).toBe(EMPTY);
  });
});
