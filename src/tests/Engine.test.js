import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Player } from '../game/Engine.js'
import { Board } from '../game/Board.js'

const ROWS = 20
const COLS = 10

function makeTetromino(shape = [{ x: 0, y: 0 }], color = 1) {
  return {
    currentShape: shape,
    color,
    position: { x: 0, y: 0 },
    rotationIndex: 0,
    clone() {
      const t = makeTetromino(shape, color)
      t.position = { ...this.position }
      t.rotationIndex = this.rotationIndex
      return t
    },
    rotate() {
      this.rotationIndex = (this.rotationIndex + 1) % 4
    },
  }
}

function makeMockSocket() {
  const socket = {
    id: 'socket1',
    on: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(),
  }
  socket.to.mockReturnValue({ emit: vi.fn() })
  return socket
}

function makeMockRoom(player) {
  const room = {
    name: 'room1',
    host: player.socketId,
    engines: new Map(),
    allPlayersDone: vi.fn(),
    roomUpdate: vi.fn(),
  }
  room.engines.set(player.socketId, player)
  return room
}

describe('Player', () => {
  let socket
  let player
  let room
  let tetrominos

  beforeEach(() => {
    socket = makeMockSocket()
    tetrominos = [makeTetromino()]
    player = new Player(socket, true, tetrominos)
    room = makeMockRoom(player)
    player.room = room
    player.username = 'testuser'

    socket.emit.mockClear()
    socket.on.mockClear()
    socket.to.mockClear()
    room.allPlayersDone.mockClear()
    room.roomUpdate.mockClear()
  })

  it('initializes to correct defaults and reset() works', () => {
    expect(player.score).toBe(0)
    expect(player.level).toBe(1)
    expect(player.clearedLines).toBe(0)
    expect(player.pieceNb).toBe(0)
    expect(player.board.grid.every(row => row.every(cell => cell === 0))).toBe(true)

    player.score = 123
    player.level = 5
    player.reset()
    expect(player.score).toBe(0)
    expect(player.level).toBe(1)
  })

  it('calculateScore returns correct points per lines', () => {
    player.level = 2
    expect(player.calculateScore(1)).toBe(200)
    expect(player.calculateScore(2)).toBe(600)
    expect(player.calculateScore(3)).toBe(1000)
    expect(player.calculateScore(4)).toBe(1600)
    expect(player.calculateScore(0)).toBe(0)
    expect(player.calculateScore(5)).toBe(0)
  })

  it('isValidPosition rejects out‑of‑bounds', () => {
    player.current.position.x = -1
    expect(player.isValidPosition(player.current)).toBe(false)
    player.current.position.x = COLS
    expect(player.isValidPosition(player.current)).toBe(false)
    player.current.position = { x: 0, y: ROWS }
    expect(player.isValidPosition(player.current)).toBe(false)
    player.current.position = { x: 3, y: 5 }
    expect(player.isValidPosition(player.current)).toBe(true)
  })

  it('canMoveDown returns false at bottom, true otherwise', () => {
    player.current.position.y = ROWS - 1
    expect(player.canMoveDown()).toBe(false)
    player.current.position.y = 0
    expect(player.canMoveDown()).toBe(true)
  })

  it('moveLeft and moveRight respect boundaries and emit GameUpdate', () => {
    player.current.position.x = 0
    player.moveLeft()
    expect(player.current.position.x).toBe(0)

    player.current.position.x = 0
    player.moveRight()
    expect(player.current.position.x).toBe(1)

    expect(socket.emit).toHaveBeenCalledWith('GameUpdate', expect.any(Object))
  })

  it('rotateCurrent increments rotationIndex when valid, reverts when invalid', () => {
    player.current.rotationIndex = 0
    player.rotateCurrent()
    expect(player.current.rotationIndex).toBe(1)

    player.current.rotationIndex = 0
    player.isValidPosition = () => false
    player.rotateCurrent()
    expect(player.current.rotationIndex).toBe(0)
  })

  it('moveDown moves piece down, increases score by level, emits GameUpdate', () => {
    player.current.position.y = 0
    player.level = 3
    player.score = 0
    player.moveDown()
    expect(player.current.position.y).toBe(1)
    expect(player.score).toBe(3)
    expect(socket.emit).toHaveBeenCalledWith('GameUpdate', expect.objectContaining({
      score: 3, level: 3
    }))
  })

  it('hardDrop drops to bottom and scores dropDistance * level', () => {
    player.current.position.y = 0
    player.level = 2
    player.score = 0
    vi.spyOn(player, 'spawnNewTetromino').mockImplementation(() => {})
    player.hardDrop()
    const dropDistance = ROWS - 1
    expect(player.score).toBe(dropDistance * 2)
    expect(socket.emit).toHaveBeenCalledWith('GameUpdate', expect.any(Object))
  })

  it('sendGameState calls allPlayersDone and emits GameUpdate with correct state', () => {
    player.score = 42; player.level = 5; player.gameOver = false
    const visual = player.getVisualGrid()
    player.sendGameState()
    expect(room.allPlayersDone).toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith('GameUpdate', expect.objectContaining({
      grid: visual,
      score: 42,
      level: 5,
      gameOver: false,
      nextPiece: undefined
    }))
  })

  it('sendGameShadow emits GameShadow to room', () => {
    const shadowSpy = vi.fn()
    socket.to.mockReturnValue({ emit: shadowSpy })
    player.score = 10; player.level = 2; player.gameOver = true
    player.sendGameShadow()
    expect(socket.to).toHaveBeenCalledWith(room.name)
    expect(shadowSpy).toHaveBeenCalledWith('GameShadow', expect.objectContaining({
      grid: player.board.grid,
      score: 10,
      level: 2,
      gameOver: true,
      socketId: 'socket1',
      nextPiece: undefined
    }))
  })

  it('reset clears score, level, clearedLines, pieceNb and creates new Board', () => {
    player.score = 999
    player.level = 10
    player.clearedLines = 5
    player.pieceNb = 3
    player.reset()
    expect(player.score).toBe(0)
    expect(player.level).toBe(1)
    expect(player.clearedLines).toBe(0)
    expect(player.pieceNb).toBe(0)
    expect(player.board).toBeInstanceOf(Board)
  })
})
