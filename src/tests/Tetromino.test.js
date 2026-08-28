import { describe, expect, it } from 'vitest';
import { AllTetrominoes, PIECE_IDS, Piece, newRandomTetromino } from '../game/Tetromino.js';

describe('Piece', () => {
  it('spawns with its colour, spawn position and first rotation', () => {
    const piece = new Piece('T');
    expect(piece.id).toBe('T');
    expect(piece.color).toBe(6);
    expect(piece.rotationIndex).toBe(0);
    expect(piece.position).toEqual({ x: 4, y: 1 });
    expect(piece.currentShape).toHaveLength(4);
    expect(piece.rotations).toHaveLength(4);
  });

  it('does not alias the position it is given', () => {
    const position = { x: 1, y: 2 };
    const piece = new Piece('T', position);
    piece.moveBy(1, 1);
    expect(position).toEqual({ x: 1, y: 2 });
  });

  it('exposes its absolute blocks', () => {
    expect(new Piece('O', { x: 0, y: 0 }).blocks).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it('rotates forwards and backwards, wrapping around', () => {
    const piece = new Piece('J');
    expect(piece.rotate().rotationIndex).toBe(1);
    expect(piece.rotateBack().rotationIndex).toBe(0);
    expect(piece.rotateBack().rotationIndex).toBe(3);
    expect(piece.rotate().rotationIndex).toBe(0);
  });

  it('moves by an offset', () => {
    const piece = new Piece('L', { x: 4, y: 1 });
    expect(piece.moveBy(-1, 2).position).toEqual({ x: 3, y: 3 });
  });

  it('clones into an independent piece', () => {
    const piece = new Piece('S').rotate();
    const copy = piece.clone();
    copy.moveBy(3, 3).rotate();

    expect(copy.id).toBe(piece.id);
    expect(piece.position).toEqual({ x: 4, y: 1 });
    expect(piece.rotationIndex).toBe(1);
  });

  it('serialises a preview payload', () => {
    const payload = new Piece('I').serialize();
    expect(payload.id).toBe('I');
    expect(payload.color).toBe(1);
    expect(payload.shape).toHaveLength(4);
    expect(payload.bounds.minX).toBeLessThanOrEqual(payload.bounds.maxX);
  });
});

describe('newRandomTetromino', () => {
  it('is driven by the injected generator', () => {
    expect(newRandomTetromino(() => 0).id).toBe('I');
    expect(newRandomTetromino(() => 0.99).id).toBe('Z');
  });

  it('always produces a known piece', () => {
    for (let i = 0; i < 30; i += 1) {
      expect(PIECE_IDS).toContain(newRandomTetromino().id);
    }
  });

  it('AllTetrominoes holds the seven shapes', () => {
    expect(AllTetrominoes.map((piece) => piece.id)).toEqual(PIECE_IDS);
  });
});
