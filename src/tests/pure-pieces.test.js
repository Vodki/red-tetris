import { describe, expect, it } from 'vitest';
import {
  PIECE_IDS,
  PIECE_MATRICES,
  blocksAt,
  boundsOf,
  buildRotations,
  colorOf,
  matrixToBlocks,
  normalizeRotation,
  nextRotation,
  previousRotation,
  randomPieceId,
  rotateMatrix,
  rotationCount,
  rotationsOf,
  shapeOf,
  spawnOf,
  translate,
} from '../game/pure/pieces.js';

describe('pure/pieces', () => {
  it('exposes the seven original tetriminoes', () => {
    expect(PIECE_IDS).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
    PIECE_IDS.forEach((id) => {
      expect(colorOf(id)).toBeGreaterThan(0);
      expect(rotationCount(id)).toBe(4);
      expect(shapeOf(id, 0)).toHaveLength(4);
    });
  });

  it('rotateMatrix turns a matrix a quarter turn clockwise', () => {
    expect(rotateMatrix(['J..', 'JJJ', '...'])).toEqual(['.JJ', '.J.', '.J.']);
  });

  it('rotateMatrix four times is the identity', () => {
    PIECE_IDS.forEach((id) => {
      const matrix = PIECE_MATRICES[id];
      const turned = rotateMatrix(rotateMatrix(rotateMatrix(rotateMatrix(matrix))));
      expect(turned).toEqual(matrix);
    });
  });

  it('does not mutate the matrix it rotates', () => {
    const matrix = ['J..', 'JJJ', '...'];
    const snapshot = [...matrix];
    rotateMatrix(matrix);
    expect(matrix).toEqual(snapshot);
  });

  it('matrixToBlocks centres the offsets on the rotation origin', () => {
    expect(matrixToBlocks(['OO', 'OO'])).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it('buildRotations produces four distinct-length-4 states', () => {
    const states = buildRotations(PIECE_MATRICES.T);
    expect(states).toHaveLength(4);
    states.forEach((state) => expect(state).toHaveLength(4));
  });

  it('the O piece looks the same in all four rotations', () => {
    expect(shapeOf('O', 0)).toEqual(shapeOf('O', 1));
    expect(shapeOf('O', 2)).toEqual(shapeOf('O', 3));
  });

  it('normalises rotation indexes, including negative ones', () => {
    expect(normalizeRotation('T', 4)).toBe(0);
    expect(normalizeRotation('T', -1)).toBe(3);
    expect(nextRotation('T', 3)).toBe(0);
    expect(previousRotation('T', 0)).toBe(3);
    expect(normalizeRotation('unknown', 2)).toBe(0);
  });

  it('falls back gracefully on unknown pieces', () => {
    expect(rotationsOf('nope')).toEqual([]);
    expect(shapeOf('nope', 0)).toEqual([]);
    expect(colorOf('nope')).toBe(0);
    expect(spawnOf('nope')).toEqual({ x: 4, y: 1 });
  });

  it('blocksAt translates the shape to board coordinates', () => {
    expect(blocksAt('O', 0, { x: 4, y: 0 })).toEqual([
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]);
  });

  it('spawnOf returns a copy, so callers cannot corrupt the table', () => {
    const spawn = spawnOf('T');
    spawn.x = 99;
    expect(spawnOf('T').x).toBe(4);
  });

  it('translate offsets a position without mutating it', () => {
    const position = { x: 2, y: 3 };
    expect(translate(position, 1, -1)).toEqual({ x: 3, y: 2 });
    expect(position).toEqual({ x: 2, y: 3 });
  });

  it('boundsOf measures a shape', () => {
    expect(boundsOf([{ x: -1, y: 0 }, { x: 1, y: 2 }])).toEqual({
      minX: -1,
      maxX: 1,
      minY: 0,
      maxY: 2,
    });
  });

  it('randomPieceId is driven by the injected generator', () => {
    expect(randomPieceId(() => 0)).toBe('I');
    expect(randomPieceId(() => 0.99)).toBe('Z');
    expect(PIECE_IDS).toContain(randomPieceId());
  });
});
