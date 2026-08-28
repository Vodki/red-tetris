/**
 * Pure piece logic.
 *
 * The subject requires the game logic that handles the board and the pieces to
 * be written with pure functions: nothing in this module uses `this`, mutates
 * its arguments or reads any shared state. Every function returns a new value
 * and always returns the same value for the same arguments.
 */

export const PIECE_IDS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/** Colour codes used by the client (see `Grid.css`, classes `color-1` … `color-7`). */
export const PIECE_COLORS = { I: 1, J: 2, L: 3, O: 4, S: 5, T: 6, Z: 7 };

/**
 * The seven original tetriminoes, described as square matrices so that the four
 * rotation states can be *computed* with the original rotation rule (90° turns
 * around the centre of the matrix) instead of being hard-coded.
 */
export const PIECE_MATRICES = {
  I: ['....', 'IIII', '....', '....'],
  J: ['J..', 'JJJ', '...'],
  L: ['..L', 'LLL', '...'],
  O: ['OO', 'OO'],
  S: ['.SS', 'SS.', '...'],
  T: ['.T.', 'TTT', '...'],
  Z: ['ZZ.', '.ZZ', '...'],
};

/** Spawn position of each piece, expressed in board coordinates. */
export const PIECE_SPAWNS = {
  I: { x: 4, y: 1 },
  J: { x: 4, y: 1 },
  L: { x: 4, y: 1 },
  O: { x: 4, y: 0 },
  S: { x: 4, y: 1 },
  T: { x: 4, y: 1 },
  Z: { x: 4, y: 1 },
};

/** Index of the cell used as the rotation centre, per matrix size. */
const ORIGINS = { 2: 0, 3: 1, 4: 1 };

/** Rotates a square matrix a quarter turn clockwise. */
export const rotateMatrix = (matrix) => {
  const size = matrix.length;
  return matrix.map((_, row) =>
    matrix.map((__, col) => matrix[size - 1 - col][row]).join('')
  );
};

/** Turns a matrix into block offsets relative to the piece's rotation centre. */
export const matrixToBlocks = (matrix) => {
  const origin = ORIGINS[matrix.length] ?? 0;
  return matrix.flatMap((row, y) =>
    row
      .split('')
      .map((cell, x) => (cell === '.' ? null : { x: x - origin, y: y - origin }))
      .filter((block) => block !== null)
  );
};

/** The four rotation states of a piece, derived from its matrix. */
export const buildRotations = (matrix) => {
  const states = [];
  let current = matrix;
  for (let step = 0; step < 4; step += 1) {
    states.push(matrixToBlocks(current));
    current = rotateMatrix(current);
  }
  return states;
};

export const PIECE_ROTATIONS = Object.freeze(
  Object.fromEntries(PIECE_IDS.map((id) => [id, buildRotations(PIECE_MATRICES[id])]))
);

export const rotationsOf = (id) => PIECE_ROTATIONS[id] ?? [];

export const rotationCount = (id) => rotationsOf(id).length;

/** Normalises any rotation index (including negative ones) into range. */
export const normalizeRotation = (id, rotationIndex) => {
  const count = rotationCount(id);
  return count === 0 ? 0 : ((rotationIndex % count) + count) % count;
};

export const shapeOf = (id, rotationIndex) =>
  rotationsOf(id)[normalizeRotation(id, rotationIndex)] ?? [];

export const colorOf = (id) => PIECE_COLORS[id] ?? 0;

export const spawnOf = (id) => ({ ...(PIECE_SPAWNS[id] ?? { x: 4, y: 1 }) });

export const nextRotation = (id, rotationIndex) =>
  normalizeRotation(id, rotationIndex + 1);

export const previousRotation = (id, rotationIndex) =>
  normalizeRotation(id, rotationIndex - 1);

/** Absolute board coordinates occupied by a piece. */
export const blocksAt = (id, rotationIndex, position) =>
  shapeOf(id, rotationIndex).map((block) => ({
    x: position.x + block.x,
    y: position.y + block.y,
  }));

export const translate = (position, dx, dy) => ({
  x: position.x + dx,
  y: position.y + dy,
});

/** Bounding box of a set of block offsets, used by the "next piece" preview. */
export const boundsOf = (blocks) =>
  blocks.reduce(
    (bounds, { x, y }) => ({
      minX: Math.min(bounds.minX, x),
      maxX: Math.max(bounds.maxX, x),
      minY: Math.min(bounds.minY, y),
      maxY: Math.max(bounds.maxY, y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

/** `random` is injectable so tests stay deterministic. */
export const randomPieceId = (random = Math.random) =>
  PIECE_IDS[Math.floor(random() * PIECE_IDS.length)] ?? PIECE_IDS[0];
