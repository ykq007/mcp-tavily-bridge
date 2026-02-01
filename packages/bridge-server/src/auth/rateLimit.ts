type Bucket = { count: number; resetAtMs: number };

export class FixedWindowRateLimiter {
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(opts: { maxPerWindow: number; windowMs: number }) {
    this.maxPerWindow = opts.maxPerWindow;
    this.windowMs = opts.windowMs;
  }

  check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterMs: number } {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAtMs) {
      this.buckets.set(key, { count: 1, resetAtMs: now + this.windowMs });
      return { ok: true };
    }
    if (bucket.count >= this.maxPerWindow) {
      return { ok: false, retryAfterMs: Math.max(0, bucket.resetAtMs - now) };
    }
    bucket.count += 1;
    return { ok: true };
  }
}

