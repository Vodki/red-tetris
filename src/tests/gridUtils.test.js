import { describe, it, expect } from 'vitest'
import { createEmptyGrid } from '../utils/gridUtils.js'

describe('createEmptyGrid()', () => {
  it('creates the default 20×10 grid of zeroes', () => {
    const g = createEmptyGrid()
    expect(g).toHaveLength(20)
    g.forEach(row => {
      expect(row).toHaveLength(10)
      row.forEach(cell => expect(cell).toBe(0))
    })
  })

  it('respects custom row/col arguments', () => {
    const g = createEmptyGrid(2, 3)
    expect(g).toEqual([
      [0, 0, 0],
      [0, 0, 0]
    ])
  })
})
