/**
 * Pure board logic.
 *
 * Same rule as `pieces.js`: no `this`, no mutation of the arguments. Every
 * function returns a brand new grid (or a plain value) so the board state can
 * be reasoned about — and unit-tested — without any hidden side effect.
 */

export const ROWS = 20;
export const COLS = 10;

/** Cell values. Penalty lines are negative so they can never complete a line. */
export const EMPTY = 0;
export const PENALTY = -1;
export const GHOST = 9;

export const createGrid = (rows = ROWS, cols = COLS) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => EMPTY));

export const copyGrid = (grid) => grid.map((row) => [...row]);

export const gridWidth = (grid) => (grid[0] ? grid[0].length : 0);

export const isInside = (grid, x, y) =>
  y >= 0 && y < grid.length && x >= 0 && x < gridWidth(grid);

export const cellAt = (grid, x, y) => (isInside(grid, x, y) ? grid[y][x] : EMPTY);

/** A line is complete only when every cell holds a piece colour (1…7). */
export const isLineFull = (grid, y) => grid[y].every((cell) => cell > EMPTY);

export const isLineEmpty = (grid, y) => grid[y].every((cell) => cell === EMPTY);

/**
 * A position is valid when every block is inside the columns, above the floor
 * and on a free cell. Blocks above the top of the field (y < 0) are tolerated
 * so a piece can spawn partially outside the visible area.
 */
export const isValidPosition = (grid, blocks) =>
  blocks.every(({ x, y }) => {
    if (x < 0 || x >= gridWidth(grid)) return false;
    if (y >= grid.length) return false;
    if (y < 0) return true;
    return grid[y][x] === EMPTY;
  });

/** Returns a new grid with `value` written at each of `blocks`. */
export const paint = (grid, blocks, value) =>
  blocks.reduce(
    (acc, { x, y }) =>
      isInside(acc, x, y)
        ? acc.map((row, rowY) =>
            rowY === y ? row.map((cell, cellX) => (cellX === x ? value : cell)) : row
          )
        : acc,
    grid
  );

/** Settles a piece into the pile. */
export const lockBlocks = (grid, blocks, color) => paint(grid, blocks, color);

export const fullLineIndexes = (grid) =>
  grid.reduce((acc, _, y) => (isLineFull(grid, y) ? [...acc, y] : acc), []);

/**
 * Removes every complete line and drops the rows above it.
 * Returns the new grid and how many lines disappeared.
 */
export const clearFullLines = (grid) => {
  const cleared = fullLineIndexes(grid);
  if (cleared.length === 0) return { grid, cleared: 0 };

  const removed = new Set(cleared);
  const kept = grid.filter((_, y) => !removed.has(y));
  const width = gridWidth(grid);

  return {
    grid: [
      ...Array.from({ length: cleared.length }, () => Array(width).fill(EMPTY)),
      ...kept,
    ],
    cleared: cleared.length,
  };
};

/**
 * Pushes `count` indestructible penalty lines at the bottom of the field.
 * `toppedOut` tells the caller that blocks were pushed past the ceiling, which
 * ends that player's game.
 */
export const addPenaltyLines = (grid, count) => {
  if (count <= 0) return { grid, toppedOut: false };

  const height = grid.length;
  const width = gridWidth(grid);
  const pushed = Math.min(count, height);
  const toppedOut = grid
    .slice(0, pushed)
    .some((row) => row.some((cell) => cell !== EMPTY));

  return {
    grid: [
      ...grid.slice(pushed),
      ...Array.from({ length: pushed }, () => Array(width).fill(PENALTY)),
    ],
    toppedOut,
  };
};

/** Height of the highest block of a column — the building block of a spectrum. */
export const columnHeight = (grid, x) => {
  const y = grid.findIndex((row) => row[x] !== EMPTY);
  return y === -1 ? 0 : grid.length - y;
};

/**
 * The "spectrum" the subject asks for: for each column, the height of its
 * highest block. This is all an opponent is ever allowed to see.
 */
export const computeSpectrum = (grid) =>
  Array.from({ length: gridWidth(grid) }, (_, x) => columnHeight(grid, x));

/** Rebuilds a displayable grid from a spectrum (client side rendering). */
export const spectrumToGrid = (spectrum, rows = ROWS) =>
  Array.from({ length: rows }, (_, y) =>
    spectrum.map((height) => (rows - y <= height ? 1 : EMPTY))
  );

/** How far a piece can still fall before touching the pile. */
export const dropDistance = (grid, blocks) => {
  let distance = 0;
  while (
    isValidPosition(
      grid,
      blocks.map(({ x, y }) => ({ x, y: y + distance + 1 }))
    )
  ) {
    distance += 1;
  }
  return distance;
};

/** Where the piece would land — drawn as a landing preview. */
export const ghostBlocks = (grid, blocks) => {
  const distance = dropDistance(grid, blocks);
  return blocks.map(({ x, y }) => ({ x, y: y + distance }));
};

/** Hides the settled pile but keeps the indestructible penalty lines visible. */
export const hidePile = (grid) =>
  grid.map((row) => row.map((cell) => (cell === PENALTY ? PENALTY : EMPTY)));

/**
 * Builds the grid the player actually sees: the pile, the landing preview and
 * the falling piece on top of it.
 */
export const renderGrid = (grid, blocks, color, options = {}) => {
  const { showGhost = true, invisible = false } = options;
  const base = invisible ? hidePile(grid) : grid;
  const withGhost = showGhost ? paint(base, ghostBlocks(grid, blocks), GHOST) : base;
  return paint(withGhost, blocks, color);
};
