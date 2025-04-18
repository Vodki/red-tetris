import { describe, it, expect } from 'vitest'
import { Piece, newRandomTetromino, AllTetrominoes } from '../game/Tetromino.js'

describe('Piece', () => {
  it('initializes with given properties', () => {
    const rotations = [
      [{ x: 0, y: 0 }],
      [{ x: 1, y: 1 }]
    ]
    const p = new Piece('X', rotations, { x: 2, y: 3 }, 'red')
    expect(p.id).toBe('X')
    expect(p.position).toEqual({ x: 2, y: 3 })
    expect(p.color).toBe('red')
    expect(p.rotationIndex).toBe(0)
    expect(p.currentShape).toBe(rotations[0])
  })

  it('rotate() advances rotationIndex modulo number of rotations', () => {
    const rotations = [
      [{ x: 0, y: 0 }],
      [{ x: 1, y: 1 }],
      [{ x: 2, y: 2 }]
    ]
    const p = new Piece('Y', rotations, { x: 0, y: 0 }, 'blue')
    p.rotate()
    expect(p.currentShape).toBe(rotations[1])
    p.rotate()
    p.rotate()
    expect(p.currentShape).toBe(rotations[0])
  })

  it('clone() returns a deep copy', () => {
    const rotations = [
      [{ x: 0, y: 0 }]
    ]
    const pos = { x: 5, y: 5 }
    const p = new Piece('Z', rotations, pos, 'green')
    p.rotate()
    const q = p.clone()
    // same values...
    expect(q.id).toBe(p.id)
    expect(q.color).toBe(p.color)
    expect(q.rotationIndex).toBe(p.rotationIndex)
    // but not the same references
    expect(q.rotations).not.toBe(p.rotations)
    expect(q.position).not.toBe(p.position)
    // modifying clone does not affect original
    q.position.x = 99
    expect(p.position.x).toBe(5)
  })
})

describe('newRandomTetromino', () => {
  it('returns one of the defined tetrominoes, with a large rotationIndex offset', () => {
    const t = newRandomTetromino()
    expect(AllTetrominoes.map(o => o.id)).toContain(t.id)
    // rotationIndex was set to original.rotations.length * 1000
    const original = AllTetrominoes.find(o => o.id === t.id)
    expect(t.rotationIndex).toBe(original.rotations.length * 1000)
  })
})
