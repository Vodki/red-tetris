import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Game, roomExists } from '../game/Room.js'
import { newRandomTetromino } from "../game/Tetromino.js"

// Mock dependencies
vi.mock('./Tetromino.js', () => ({
  newRandomTetromino: vi.fn(() => ({ shape: [[1]], color: 'red' }))
}))

class MockEngine {
  constructor(username, socketId) {
    this.username = username
    this.socketId = socketId
    this.isRunning = false
    this.pieceNb = 0
  }
  
  getVisualGrid() { return [[0]] }
  start() { this.isRunning = true }
  reset() { this.pieceNb = 0 }
}

describe('Game', () => {
  let mockIo
  let game

  beforeEach(() => {
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      sockets: {
        adapter: {
          rooms: new Map()
        }
      }
    }
    
    game = new Game('test-room', 'host-id', mockIo)
    game.engines.set('player1', new MockEngine('user1', 'socket1'))
  })

  describe('roomExists', () => {
    it('should return true when room exists', () => {
      mockIo.sockets.adapter.rooms.set('existing-room', new Set())
      expect(roomExists(mockIo, 'existing-room')).toBe(true)
    })

    it('should return false when room doesnt exist', () => {
      expect(roomExists(mockIo, 'non-existent-room')).toBe(false)
    })
  })

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(game.name).toBe('test-room')
      expect(game.host).toBe('host-id')
      expect(game.isRunning).toBe(false)
    //   expect(newRandomTetromino).toHaveBeenCalledTimes(2)
      expect(game.tetrominos).toHaveLength(2)
    })
  })

  describe('serializePlayers', () => {
    it('should serialize players correctly', () => {
      const result = game.serializePlayers()
      expect(result).toEqual({
        host: 'host-id',
        players: [{
          username: 'user1',
          socketId: 'socket1',
          grid: [[0]]
        }]
      })
    })
  })

  describe('allPlayersDone', () => {
    it('should return true when all players are done', () => {
      game.engines.get('player1').isRunning = false
      expect(game.allPlayersDone()).toBe(true)
      expect(mockIo.emit).toHaveBeenCalledWith('allPlayersDone', true)
      expect(game.isRunning).toBe(false)
    })

    it('should return false when any player is still running', () => {
      game.engines.get('player1').isRunning = true
      expect(game.allPlayersDone()).toBe(false)
    })

    it('should reset players with non-zero piece count', () => {
      const engine = game.engines.get('player1')
      engine.pieceNb = 5
      engine.isRunning = false
      game.allPlayersDone()
      expect(engine.pieceNb).toBe(0)
    })
  })

  describe('startGames', () => {
    it('should start all games and emit event', () => {
      game.startGames()
      expect(mockIo.emit).toHaveBeenCalledWith('allPlayersDone', false)
      expect(game.isRunning).toBe(true)
      game.engines.forEach(engine => {
        expect(engine.isRunning).toBe(true)
      })
    })
  })

  describe('roomUpdate', () => {
    it('should emit room update with serialized players', () => {
      game.roomUpdate()
      expect(mockIo.to).toHaveBeenCalledWith('test-room')
      expect(mockIo.emit).toHaveBeenCalledWith('roomUpdate', {
        host: 'host-id',
        players: [{
          username: 'user1',
          socketId: 'socket1',
          grid: [[0]]
        }]
      })
    })
  })
})
