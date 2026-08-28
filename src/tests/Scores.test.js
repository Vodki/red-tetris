// @vitest-environment node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_ENTRIES,
  Scoreboard,
  compareEntries,
  defaultScoresFile,
  mergeEntry,
  sanitizeEntry,
} from '../game/Scores.js';

describe('score helpers', () => {
  it('ranks by score, then lines, then recency', () => {
    expect(compareEntries({ score: 10 }, { score: 20 })).toBeGreaterThan(0);
    expect(compareEntries({ score: 10, lines: 5 }, { score: 10, lines: 2 })).toBeLessThan(0);
    expect(
      compareEntries(
        { score: 1, lines: 1, date: '2024-01-01' },
        { score: 1, lines: 1, date: '2024-02-01' }
      )
    ).toBeGreaterThan(0);
  });

  it('mergeEntry inserts, sorts and caps without mutating', () => {
    const entries = [{ score: 50, lines: 0, date: 'a' }];
    const merged = mergeEntry(entries, { score: 100, lines: 0, date: 'b' });

    expect(merged[0].score).toBe(100);
    expect(entries).toHaveLength(1);
    expect(mergeEntry(merged, { score: 1, lines: 0, date: 'c' }, 2)).toHaveLength(2);
    expect(MAX_ENTRIES).toBeGreaterThan(0);
  });

  it('sanitizeEntry keeps only sane values', () => {
    const entry = sanitizeEntry(
      { username: 'x'.repeat(80), score: 'nope', lines: 3, won: 1, room: 'r' },
      '2024-05-05'
    );

    expect(entry.username).toHaveLength(30);
    expect(entry.score).toBe(0);
    expect(entry.lines).toBe(3);
    expect(entry.level).toBe(1);
    expect(entry.won).toBe(true);
    expect(entry.mode).toBe('classic');
    expect(entry.date).toBe('2024-05-05');
  });

  it('sanitizeEntry falls back to anonymous', () => {
    expect(sanitizeEntry({}).username).toBe('anonymous');
  });

  it('defaultScoresFile honours SCORES_FILE', () => {
    process.env.SCORES_FILE = '/tmp/red-tetris-scores.json';
    expect(defaultScoresFile()).toBe('/tmp/red-tetris-scores.json');
    delete process.env.SCORES_FILE;
    expect(defaultScoresFile()).toContain('.scores.json');
  });
});

describe('Scoreboard', () => {
  let dir;
  let file;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'red-tetris-'));
    file = path.join(dir, 'scores.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('starts empty when there is no file yet', async () => {
    const board = new Scoreboard(file);
    expect(await board.load()).toEqual([]);
    expect(board.top()).toEqual([]);
  });

  it('records a score and persists it', async () => {
    const board = new Scoreboard(file);
    board.record({ username: 'Alice', score: 900, lines: 4, level: 1 });
    await board.writing;

    const reloaded = new Scoreboard(file);
    await reloaded.load();
    expect(reloaded.top()[0].username).toBe('Alice');
    expect(reloaded.top()[0].score).toBe(900);
  });

  it('keeps the ranking ordered and limits the top', async () => {
    const board = new Scoreboard(file);
    board.record({ username: 'Low', score: 10, lines: 0, level: 1 });
    board.record({ username: 'High', score: 999, lines: 0, level: 1 });
    await board.writing;

    expect(board.top().map((entry) => entry.username)).toEqual(['High', 'Low']);
    expect(board.top(1)).toHaveLength(1);
  });

  it('recovers from a corrupted file', async () => {
    await fs.writeFile(file, 'not json at all', 'utf8');
    const board = new Scoreboard(file);
    expect(await board.load()).toEqual([]);
  });

  it('ignores a file that does not hold a list', async () => {
    await fs.writeFile(file, '{"nope":true}', 'utf8');
    expect(await new Scoreboard(file).load()).toEqual([]);
  });

  it('swallows write errors instead of crashing a game', async () => {
    const board = new Scoreboard(path.join(dir, 'missing', 'deep', 'scores.json'));
    board.record({ username: 'Alice', score: 1, lines: 0, level: 1 });
    await expect(board.writing).resolves.toBeUndefined();
  });
});
