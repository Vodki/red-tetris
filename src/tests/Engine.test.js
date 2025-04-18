import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// 1) Mock Board *inline*, so we never reference an out‐of‐scope DummyBoard
vi.mock('../game/Board.js', () => {
  return {
    Board: class {
      constructor() {
        this.grid = Array(20).fill(0).map(() => Array(10).fill(0));
      }
      fillBoard(x, y, c) { this.grid[y][x] = c }
      clearFullLines() { return 0 }
      addPenality() { return true }
    }
  }
})

// We don’t need to mock Tetromino at all if we supply our own pieces below.

// Now import *after* the mocks:
import { Player } from '../game/Engine.js'

describe('Player (Engine.js)', () => {
  // A simple fake piece class for feeding into the Player
  class FakePiece {
    constructor(pos, shape) {
      this.position = { ...pos }
      this._shape = shape             // array of {x,y}
      this.color = 9
      this.rotationIndex = 0
    }
    get currentShape() { return this._shape }
    rotate() { this.rotationIndex++ }
    clone() {
      const c = new FakePiece(this.position, this._shape)
      c.rotationIndex = this.rotationIndex
      return c
    }
  }

  let socket, pl

  beforeEach(() => {
    // Give Player a stub socket
    socket = { id: 'S1', on: vi.fn(), emit: vi.fn() }

    // Create a starting piece at (4,0), shape single block
    const startPiece = new FakePiece({ x: 4, y: 0 }, [{ x: 0, y: 0 }])
    pl = new Player(socket, false, [startPiece])

    // stub out the methods that emit to socket / io
    pl.sendGameState = vi.fn()
    pl.sendGameShadow = vi.fn()
    pl.handleGameOver = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('constructor sets initial flags and registers socket handler', () => {
    expect(pl.socket).toBe(socket)
    expect(pl.isHost).toBe(false)
    expect(socket.on).toHaveBeenCalledWith('gameInput', expect.any(Function))
  })

  it('reset() initializes board, current piece and stats', () => {
    pl.score = 42
    pl.level = 7
    pl.reset()
    expect(pl.board.grid.length).toBe(20)
    expect(pl.score).toBe(0)
    expect(pl.level).toBe(1)
    expect(pl.current).toBeDefined()
    expect(pl.pieceNb).toBe(0)
  })

  it('calculateScore() matches Tetris scoring rules', () => {
    pl.level = 2
    expect(pl.calculateScore(1)).toBe(200)
    expect(pl.calculateScore(2)).toBe(600)
    expect(pl.calculateScore(3)).toBe(1000)
    expect(pl.calculateScore(4)).toBe(1600)
    expect(pl.calculateScore(5)).toBe(0)
  })

  it('isValidPosition(): blocks out of bounds or collisions', () => {
    // x < 0
    let bad = new FakePiece({ x: -1, y: 0 }, [{ x: 0, y: 0 }])
    expect(pl.isValidPosition(bad)).toBe(false)

    // y >= ROWS
    bad = new FakePiece({ x: 0, y: 20 }, [{ x: 0, y: 0 }])
    expect(pl.isValidPosition(bad)).toBe(false)

    // collision
    pl.board.grid[0][0] = 5
    bad = new FakePiece({ x: 0, y: 0 }, [{ x: 0, y: 0 }])
    expect(pl.isValidPosition(bad)).toBe(false)

    // valid
    const ok = new FakePiece({ x: 1, y: 1 }, [{ x: 0, y: 0 }])
    expect(pl.isValidPosition(ok)).toBe(true)
  })

  it('canMoveDown() increments y when valid, false at bottom', () => {
    expect(pl.canMoveDown()).toBe(true)
    pl.current.position.y = 19
    expect(pl.canMoveDown()).toBe(false)
  })

  it('moveLeft/moveRight enforce bounds and call sendGameState()', () => {
    pl.current.position.x = 0
    pl.moveLeft()
    expect(pl.current.position.x).toBe(0)
    expect(pl.sendGameState).toHaveBeenCalled()

    pl.current.position.x = 9
    pl.moveRight()
    expect(pl.current.position.x).toBe(9)
    expect(pl.sendGameState).toHaveBeenCalledTimes(2)
  })

  it('rotateCurrent() reverts on invalid rotation', () => {
    // force invalid
    vi.spyOn(pl, 'isValidPosition').mockReturnValue(false)
    const orig = pl.current.rotationIndex
    pl.rotateCurrent()
    expect(pl.current.rotationIndex).toBe(orig)
    expect(pl.sendGameState).toHaveBeenCalled()
  })

  it('moveDown() chooses between drop and lock logic', () => {
    // valid drop branch
    pl.current.position.y = 0
    pl.score = 0
    pl.level = 1
    pl.moveDown()
    expect(pl.current.position.y).toBe(1)
    expect(pl.score).toBe(1)   // +level
    expect(pl.sendGameState).toHaveBeenCalled()
  })

  it('start() / stop() toggle interval & isRunning', () => {
    vi.useFakeTimers()
    pl.start()
    expect(pl.isRunning).toBe(true)
    expect(pl.intervalId).not.toBeNull()
    pl.stop()
    expect(pl.isRunning).toBe(false)
    expect(pl.intervalId).toBeNull()
  })

  it('disconnect() clears interval when no room attached', () => {
    pl.intervalId = 123
    expect(() => pl.disconnect()).not.toThrow()
    expect(pl.intervalId).toBeNull()
  })
})
