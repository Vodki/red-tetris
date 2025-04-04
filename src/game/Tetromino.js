export class Tetromino {
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
      let t = new Tetromino(
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
    new Tetromino('I',
      [
        [{x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:0,y:2}],
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:2,y:0}]
      ],
      {x:4,y:1}, 1,
    ),
    new Tetromino('J',
      [
        [{x:-1,y:-1}, {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}],
        [{x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:1,y:-1}],
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:1,y:1}],
        [{x:-1,y:1}, {x:0,y:-1}, {x:0,y:0}, {x:0,y:1}]
      ],
      {x:4,y:1}, 2
    ),
    new Tetromino('L', 
      [
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:1,y:-1}],
        [{x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:1,y:1}],
        [{x:-1,y:1}, {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}],
        [{x:-1,y:-1}, {x:0,y:-1}, {x:0,y:0}, {x:0,y:1}]
      ],
      {x:4,y:1}, 3
    ),
    new Tetromino('O', 
      [[{x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1}]],
      {x:4,y:0}, 4
    ),
    new Tetromino('S',
      [
        [{x:0,y:0}, {x:1,y:0}, {x:-1,y:1}, {x:0,y:1}],
        [{x:0,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:1,y:1}]
      ],
      {x:4,y:0}, 5
    ),
    new Tetromino('T',
      [
        [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1}],
        [{x:0,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1}],
        [{x:0,y:-1}, {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}],
        [{x:0,y:-1}, {x:-1,y:0}, {x:0,y:0}, {x:0,y:1}]
      ],
      {x:4,y:0}, 6
    ),
    new Tetromino('Z',
      [
        [{x:-1,y:0}, {x:0,y:0}, {x:0,y:1}, {x:1,y:1}],
        [{x:1,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1}]
      ],
      {x:4,y:0}, 7
    )
  ];