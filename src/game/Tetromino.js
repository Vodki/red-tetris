import {
  PIECE_COLORS,
  PIECE_IDS,
  blocksAt,
  boundsOf,
  colorOf,
  nextRotation,
  previousRotation,
  randomPieceId,
  rotationsOf,
  shapeOf,
  spawnOf,
} from './pure/pieces.js';

/**
 * Server side model of a tetrimino.
 *
 * The subject asks the server to be object oriented with, at least, a `Piece`
 * class — while the actual board/piece maths lives in the pure modules this
 * class only delegates to.
 */
export class Piece {
  constructor(id, position = spawnOf(id), rotationIndex = 0) {
    this.id = id;
    this.color = colorOf(id);
    this.position = { ...position };
    this.rotationIndex = rotationIndex;
  }

  get rotations() {
    return rotationsOf(this.id);
  }

  get currentShape() {
    return shapeOf(this.id, this.rotationIndex);
  }

  /** Absolute board coordinates currently occupied by the piece. */
  get blocks() {
    return blocksAt(this.id, this.rotationIndex, this.position);
  }

  rotate() {
    this.rotationIndex = nextRotation(this.id, this.rotationIndex);
    return this;
  }

  rotateBack() {
    this.rotationIndex = previousRotation(this.id, this.rotationIndex);
    return this;
  }

  moveBy(dx, dy) {
    this.position = { x: this.position.x + dx, y: this.position.y + dy };
    return this;
  }

  clone() {
    return new Piece(this.id, this.position, this.rotationIndex);
  }

  /** Minimal payload sent to the client for the "next piece" preview. */
  serialize() {
    const shape = this.currentShape;
    return {
      id: this.id,
      color: this.color,
      shape,
      bounds: boundsOf(shape),
    };
  }
}

/**
 * Creates a random piece. `random` is injectable so the sequence can be made
 * deterministic in the tests.
 */
export const newRandomTetromino = (random = Math.random) =>
  new Piece(randomPieceId(random));

/** One pristine instance of every tetrimino, in the canonical order. */
export const AllTetrominoes = PIECE_IDS.map((id) => new Piece(id));

export { PIECE_IDS, PIECE_COLORS };
