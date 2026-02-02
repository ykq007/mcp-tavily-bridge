import { describe, expect, it, vi } from 'vitest';

import { QueuedRateGate } from '../src/brave/rateGate.js';

describe('QueuedRateGate', () => {
  it('enforces a minimum interval between starts', async () => {
    vi.useFakeTimers();
    try {
      const gate = new QueuedRateGate({ minIntervalMs: 1000 });
      const starts: number[] = [];

      const p1 = gate.run(async () => {
        starts.push(Date.now());
        return 1;
      });
      const p2 = gate.run(async () => {
        starts.push(Date.now());
        return 2;
      });
      const p3 = gate.run(async () => {
        starts.push(Date.now());
        return 3;
      });

      await vi.runAllTimersAsync();
      await expect(Promise.all([p1, p2, p3])).resolves.toEqual([1, 2, 3]);

      expect(starts).toHaveLength(3);
      expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(1000);
      expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(1000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails when maxWaitMs is exceeded', async () => {
    vi.useFakeTimers();
    try {
      const gate = new QueuedRateGate({ minIntervalMs: 1000 });

      const p1 = gate.run(async () => {
        await new Promise((r) => setTimeout(r, 10_000));
        return 'ok';
      });

      const p2 = gate.run(async () => 'late', { maxWaitMs: 500 });
      const p2Expectation = expect(p2).rejects.toMatchObject({ name: 'BraveRateGateTimeoutError' });

      await vi.advanceTimersByTimeAsync(600);
      await p2Expectation;

      // Ensure the queue still drains.
      await vi.runAllTimersAsync();
      await expect(p1).resolves.toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });
});
