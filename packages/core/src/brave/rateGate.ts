import { BraveRateGateTimeoutError } from './errors.js';

type Sleep = (ms: number) => Promise<void>;
type Now = () => number;

export class QueuedRateGate {
  private readonly minIntervalMs: number;
  private readonly sleep: Sleep;
  private readonly now: Now;
  private lastStartAtMs = 0;
  private tail: Promise<void> = Promise.resolve();

  constructor(opts: { minIntervalMs: number; sleep?: Sleep; now?: Now }) {
    this.minIntervalMs = Math.max(0, Math.floor(opts.minIntervalMs));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? (() => Date.now());
  }

  async run<T>(fn: () => Promise<T>, opts?: { maxWaitMs?: number }): Promise<T> {
    const enqueuedAtMs = this.now();
    const maxWaitMs = typeof opts?.maxWaitMs === 'number' ? Math.max(0, Math.floor(opts.maxWaitMs)) : undefined;

    let resolveDone!: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));
    const prev = this.tail;
    this.tail = prev.then(() => done).catch(() => done);

    try {
      if (typeof maxWaitMs === 'number') {
        const remainingMs = Math.max(0, maxWaitMs - (this.now() - enqueuedAtMs));
        if (remainingMs === 0) {
          throw new BraveRateGateTimeoutError('Brave request queue timeout', { maxWaitMs });
        }
        let timeoutId: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new BraveRateGateTimeoutError('Brave request queue timeout', { maxWaitMs })), remainingMs);
        });
        try {
          await Promise.race([prev, timeoutPromise]);
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        await prev;
      }
    } catch (err) {
      resolveDone();
      throw err;
    }

    const nextAllowedAtMs = this.lastStartAtMs + this.minIntervalMs;
    const delayMs = nextAllowedAtMs - this.now();
    if (delayMs > 0) await this.sleep(delayMs);

    this.lastStartAtMs = this.now();
    try {
      return await fn();
    } finally {
      resolveDone();
    }
  }
}
