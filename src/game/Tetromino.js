export class Piece {
    constructor(id, rotations, position, color, rotationIndex) {
      this.id = id;
      this.rotations = rotations;
      this.rotationIndex = 0;
      this.position = position;
      this.color = color;
    }
  
    get currentShape() {
      return this.rotations[this.rotationIndex % this.rotations.length];
    }
  
    rotate() {
      this.rotationIndex = (this.rotationIndex + 1) % this.rotations.length;
    }
  
    clone() {
      let t = new Piece(
        this.id,
        structuredClone(this.rotations),
        structuredClone(this.position),
        this.color,
      );
      t.rotationIndex = this.rotationIndex;
      return t;
    }
}

export function newRandomTetromino() {
  const index = Math.floor(Math.random() * AllTetrominoes.length);
  const original = AllTetrominoes[index];
  const clone = original.clone();
  clone.rotationIndex = original.rotations.length * 1000; // Mirror Go's rotation setup
  return clone;
}

const AllTetrominoes = [
    new Piece('I',
      [
        [{x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:0,y:2}],
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:2,y:0}]
      ],
      {x:4,y:1}, 1,
    ),
    new Piece('J',
      [
        [{x:-1,y:-1}, {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}],
        [{x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:1,y:-1}],
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:1,y:1}],
        [{x:-1,y:1}, {x:0,y:-1}, {x:0,y:0}, {x:0,y:1}]
      ],
      {x:4,y:1}, 2
    ),
    new Piece('L', 
      [
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:1,y:-1}],
        [{x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:1,y:1}],
        [{x:-1,y:1}, {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}],
        [{x:-1,y:-1}, {x:0,y:-1}, {x:0,y:0}, {x:0,y:1}]
      ],
      {x:4,y:1}, 3
    ),
    new Piece('O', 
      [[{x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1}]],
      {x:4,y:0}, 4
    ),
    new Piece('S',
      [
        [{x:0,y:0}, {x:1,y:0}, {x:-1,y:1}, {x:0,y:1}],
        [{x:0,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:1,y:1}]
      ],
      {x:4,y:0}, 5
    ),
    new Piece('T',
      [
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1}],
        [{x:0,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1}],
        [{x:0,y:-1}, {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}],
        [{x:0,y:-1}, {x:-1,y:0}, {x:0,y:0}, {x:0,y:1}]
      ],
      {x:4,y:0}, 6
    ),
    new Piece('Z',
      [
        [{x:-1,y:0}, {x:0,y:0}, {x:0,y:1}, {x:1,y:1}],
        [{x:1,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1}]
      ],
      {x:4,y:0}, 7
    )
  ];