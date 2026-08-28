import { promises as fs } from 'node:fs';
import path from 'node:path';

export const MAX_ENTRIES = 100;

/** Best score first, then most lines, then most recent. */
export const compareEntries = (a, b) =>
  b.score - a.score || b.lines - a.lines || String(b.date).localeCompare(String(a.date));

/** Pure: inserts an entry into a ranking and keeps it capped. */
export const mergeEntry = (entries, entry, max = MAX_ENTRIES) =>
  [...entries, entry].sort(compareEntries).slice(0, max);

/** Pure: only keeps the fields we are willing to persist. */
export const sanitizeEntry = (entry, date = new Date().toISOString()) => ({
  username: String(entry.username || 'anonymous').slice(0, 30),
  score: Number.isFinite(entry.score) ? entry.score : 0,
  lines: Number.isFinite(entry.lines) ? entry.lines : 0,
  level: Number.isFinite(entry.level) ? entry.level : 1,
  room: String(entry.room || ''),
  mode: String(entry.mode || 'classic'),
  won: Boolean(entry.won),
  date,
});

export const defaultScoresFile = () =>
  process.env.SCORES_FILE || path.join(process.cwd(), '.scores.json');

/**
 * Bonus: a tiny JSON-file backed leaderboard.
 *
 * The game itself needs no persistence (the subject says so); this only keeps
 * the finished players' scores around across restarts. Writes are serialised
 * and never block a game tick.
 */
export class Scoreboard {
  constructor(file = defaultScoresFile()) {
    this.file = file;
    this.entries = [];
    this.writing = Promise.resolve();
  }

  async load() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.entries = Array.isArray(parsed) ? parsed.sort(compareEntries) : [];
    } catch {
      this.entries = [];
    }
    return this.entries;
  }

  top(limit = 10) {
    return this.entries.slice(0, limit);
  }

  record(entry) {
    this.entries = mergeEntry(this.entries, sanitizeEntry(entry));
    this.persist();
    return this.entries;
  }

  /** Fire and forget, but serialised so two writes never interleave. */
  persist() {
    const snapshot = JSON.stringify(this.entries, null, 2);
    this.writing = this.writing
      .then(() => fs.writeFile(this.file, snapshot, 'utf8'))
      .catch(() => {});
    return this.writing;
  }
}
