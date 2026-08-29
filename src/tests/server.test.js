// @vitest-environment node
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prepare = vi.fn().mockResolvedValue(undefined);
const getRequestHandler = vi.fn(() => (req, res) => res.end('ok'));

vi.mock('next', () => ({
  default: vi.fn(() => ({ prepare, getRequestHandler })),
}));

describe('createServerInstance', () => {
  let instance;
  let previousScoresFile;

  beforeEach(() => {
    process.env.NODE_TEST = 'true';
    // The scoreboard defaults to `./.scores.json`. Playing a single game leaves
    // that file behind, so pin it to a path that cannot exist: the test asserts
    // on a *fresh* server, not on whatever was persisted on this machine.
    previousScoresFile = process.env.SCORES_FILE;
    process.env.SCORES_FILE = path.join(
      tmpdir(),
      `red-tetris-scores-${process.pid}-${Math.random().toString(36).slice(2)}.json`
    );
    vi.resetModules();
  });

  afterEach(async () => {
    if (previousScoresFile === undefined) delete process.env.SCORES_FILE;
    else process.env.SCORES_FILE = previousScoresFile;

    if (instance) {
      instance.io.close();
      await new Promise((resolve) => instance.httpServer.close(resolve));
      instance = null;
    }
  });

  it('boots Next, an HTTP server and socket.io together', async () => {
    const { createServerInstance } = await import('../server.js');
    instance = await createServerInstance();

    expect(prepare).toHaveBeenCalled();
    expect(getRequestHandler).toHaveBeenCalled();
    expect(instance.httpServer).toBeDefined();
    expect(instance.io).toBeDefined();
  });

  it('exposes an empty game state and a loaded scoreboard', async () => {
    const { createServerInstance } = await import('../server.js');
    instance = await createServerInstance();

    expect(instance.rooms.size).toBe(0);
    expect(instance.players.size).toBe(0);
    expect(instance.engines.size).toBe(0);
    expect(instance.scoreboard.top()).toEqual([]);
  });

  it('registers the game handlers on every new connection', async () => {
    const { createServerInstance } = await import('../server.js');
    instance = await createServerInstance();

    expect(instance.io.listeners('connection')).toHaveLength(1);
  });

  it('serves HTTP through the Next request handler', async () => {
    const { createServerInstance } = await import('../server.js');
    instance = await createServerInstance();

    await new Promise((resolve) => instance.httpServer.listen(0, resolve));
    const port = instance.httpServer.address().port;
    const response = await fetch(`http://localhost:${port}/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});
