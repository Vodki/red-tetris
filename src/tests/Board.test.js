import { describe, it, expect, beforeEach } from 'vitest'
import { Board } from '../game/Board.js'

describe('Board', () => {
  let board
  beforeEach(() => {
    board = new Board()
  })

  it('initializes a 20×10 grid filled with 0', () => {
    expect(board.grid.length).toBe(20)
    expect(board.grid[0].length).toBe(10)
    for (const row of board.grid) {
      for (const cell of row) {
        expect(cell).toBe(0)
      }
    }
  })

  it('fillBoard(x,y,color) sets only that cell', () => {
    board.fillBoard(3, 4, 7)
    expect(board.grid[4][3]).toBe(7)
    expect(board.grid[4][2]).toBe(0)
    expect(board.grid[3][3]).toBe(0)
  })

  it('lineIsEmpty and lineIsFull detect correctly', () => {
    expect(board.lineIsEmpty(0)).toBe(true)
    expect(board.lineIsFull(0)).toBe(false)
    board.grid[0].fill(5)
    expect(board.lineIsEmpty(0)).toBe(false)
    expect(board.lineIsFull(0)).toBe(true)
  })

  it('clearFullLines removes full lines and shifts grid down', () => {
    board.grid[19].fill(1)
    board.grid[18].fill(1)
    const removed = board.clearFullLines()
    expect(removed).toBe(2)
    expect(board.grid.length).toBe(20)
    expect(board.grid[0].every(c => c === 0)).toBe(true)
    expect(board.grid[1].every(c => c === 0)).toBe(true)
  })

  it('addPenality shifts rows up and bottom rows become -1, returns 1', () => {
    const result = board.addPenality(3)
    expect(result).toBe(1)
    for (let y = 17; y < 20; y++) {
      expect(board.grid[y].every(c => c === -1)).toBe(true)
    }
    for (let y = 0; y < 17; y++) {
      expect(board.grid[y].every(c => c === 0)).toBe(true)
    }
  })

  it('addPenality returns 0 and does nothing if top rows are non-empty', () => {
    board.grid[0][0] = 1
    const copy = board.grid.map(r => [...r])
    const result = board.addPenality(2)
    expect(result).toBe(0)
    for (let y = 0; y < 20; y++) {
      expect(board.grid[y]).toEqual(copy[y])
    }
  })
})
