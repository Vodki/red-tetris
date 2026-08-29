import {
  COLS,
  ROWS,
  addPenaltyLines,
  clearFullLines,
  computeSpectrum,
  copyGrid,
  createGrid,
  isLineEmpty,
  isLineFull,
  isValidPosition,
  lockBlocks,
  renderGrid,
} from './pure/board.js';

/**
 * Server side model of a playing field.
 *
 * The class only holds the current grid: every transformation is delegated to
 * the pure functions of `pure/board.js`, which return a brand new grid.
 */
export class Board {
  constructor(grid = createGrid(ROWS, COLS)) {
    this.grid = grid;
  }

  get rows() {
    return this.grid.length;
  }

  get cols() {
    return this.grid[0] ? this.grid[0].length : 0;
  }

  gridCopy() {
    return copyGrid(this.grid);
  }

  lineIsFull(y) {
    return isLineFull(this.grid, y);
  }

  lineIsEmpty(y) {
    return isLineEmpty(this.grid, y);
  }

  /** Can this set of absolute block coordinates be occupied? */
  isValid(blocks) {
    return isValidPosition(this.grid, blocks);
  }

  /** Settles a piece into the pile. */
  lock(blocks, color) {
    this.grid = lockBlocks(this.grid, blocks, color);
    return this;
  }

  /** Removes the complete lines and returns how many disappeared. */
  clearFullLines() {
    const { grid, cleared } = clearFullLines(this.grid);
    this.grid = grid;
    return cleared;
  }

  /**
   * Adds `count` indestructible lines at the bottom.
   * Returns `false` when the player is pushed past the ceiling (game over).
   */
  addPenalty(count) {
    const { grid, toppedOut } = addPenaltyLines(this.grid, count);
    this.grid = grid;
    return !toppedOut;
  }

  /** Height of each column - the only thing opponents get to see. */
  spectrum() {
    return computeSpectrum(this.grid);
  }

  /** Grid as displayed to its owner: pile + landing preview + falling piece. */
  render(blocks, color, options) {
    return renderGrid(this.grid, blocks, color, options);
  }
}
