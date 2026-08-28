import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from '../game/Board.js';
import { PENALTY } from '../game/pure/board.js';

describe('Board', () => {
  let board;

  beforeEach(() => {
    board = new Board();
  });

  it('starts as an empty 20x10 field', () => {
    expect(board.rows).toBe(20);
    expect(board.cols).toBe(10);
    expect(board.grid.every((row) => row.every((cell) => cell === 0))).toBe(true);
    expect(board.spectrum()).toEqual(Array(10).fill(0));
  });

  it('gridCopy hands out an independent grid', () => {
    const copy = board.gridCopy();
    copy[0][0] = 9;
    expect(board.grid[0][0]).toBe(0);
  });

  it('locks blocks into the pile', () => {
    board.lock([{ x: 2, y: 19 }], 4);
    expect(board.grid[19][2]).toBe(4);
    expect(board.spectrum()[2]).toBe(1);
    expect(board.isValid([{ x: 2, y: 19 }])).toBe(false);
  });

  it('reports full and empty lines', () => {
    expect(board.lineIsEmpty(0)).toBe(true);
    board.grid = board.grid.map((row, y) => (y === 19 ? Array(10).fill(1) : row));
    expect(board.lineIsFull(19)).toBe(true);
  });

  it('clears complete lines', () => {
    board.grid = board.grid.map((row, y) => (y >= 18 ? Array(10).fill(1) : row));
    expect(board.clearFullLines()).toBe(2);
    expect(board.spectrum()).toEqual(Array(10).fill(0));
  });

  it('adds penalty lines and survives while there is room', () => {
    expect(board.addPenalty(3)).toBe(true);
    expect(board.grid[19]).toEqual(Array(10).fill(PENALTY));
    expect(board.clearFullLines()).toBe(0);
  });

  it('signals a top-out when the penalty pushes blocks out', () => {
    board.lock([{ x: 0, y: 0 }], 2);
    expect(board.addPenalty(1)).toBe(false);
  });

  it('renders the pile with the falling piece and its landing preview', () => {
    const rendered = board.render([{ x: 0, y: 0 }], 3);
    expect(rendered[0][0]).toBe(3);
    expect(rendered[19][0]).toBe(9);
  });
});
