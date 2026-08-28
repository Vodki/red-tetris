import { describe, expect, it } from 'vitest';
import {
  BASE_SPEED,
  CLASSIC,
  DEFAULT_MODE,
  GAME_MODES,
  GRAVITY,
  INVISIBLE,
  isGameMode,
  levelForLines,
  normalizeMode,
  penaltyForLines,
  pileIsHidden,
  scoreForLines,
  speedForLevel,
} from '../game/pure/rules.js';

describe('pure/rules', () => {
  it('knows its game modes', () => {
    expect(GAME_MODES).toEqual([CLASSIC, GRAVITY, INVISIBLE]);
    expect(DEFAULT_MODE).toBe(CLASSIC);
    expect(isGameMode(GRAVITY)).toBe(true);
    expect(isGameMode('nope')).toBe(false);
    expect(normalizeMode('nope')).toBe(CLASSIC);
    expect(normalizeMode(INVISIBLE)).toBe(INVISIBLE);
  });

  it('scores line clears, multiplied by the level', () => {
    expect(scoreForLines(0)).toBe(0);
    expect(scoreForLines(1)).toBe(100);
    expect(scoreForLines(2)).toBe(300);
    expect(scoreForLines(3)).toBe(500);
    expect(scoreForLines(4)).toBe(800);
    expect(scoreForLines(4, 3)).toBe(2400);
    expect(scoreForLines(9)).toBe(0);
  });

  it('levels up every ten lines', () => {
    expect(levelForLines(0)).toBe(1);
    expect(levelForLines(9)).toBe(1);
    expect(levelForLines(10)).toBe(2);
    expect(levelForLines(25)).toBe(3);
  });

  it('keeps a constant speed outside the gravity mode', () => {
    expect(speedForLevel(1, CLASSIC)).toBe(BASE_SPEED);
    expect(speedForLevel(9, CLASSIC)).toBe(BASE_SPEED);
    expect(speedForLevel(9, INVISIBLE)).toBe(BASE_SPEED);
    expect(speedForLevel(5)).toBe(BASE_SPEED);
  });

  it('accelerates in the gravity mode, down to a floor', () => {
    expect(speedForLevel(1, GRAVITY)).toBe(BASE_SPEED);
    expect(speedForLevel(2, GRAVITY)).toBe(BASE_SPEED - 45);
    expect(speedForLevel(100, GRAVITY)).toBe(80);
  });

  it('only hides the pile in the invisible mode', () => {
    expect(pileIsHidden(INVISIBLE)).toBe(true);
    expect(pileIsHidden(CLASSIC)).toBe(false);
  });

  it('sends n-1 penalty lines', () => {
    expect(penaltyForLines(0)).toBe(0);
    expect(penaltyForLines(1)).toBe(0);
    expect(penaltyForLines(2)).toBe(1);
    expect(penaltyForLines(4)).toBe(3);
  });
});
