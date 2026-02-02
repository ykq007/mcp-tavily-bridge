export class BraveHttpError extends Error {
  readonly status: number;
  readonly braveMessage?: string;
  readonly retryAfterMs?: number;

  constructor(message: string, opts: { status: number; braveMessage?: string; retryAfterMs?: number }) {
    super(message);
    this.name = 'BraveHttpError';
    this.status = opts.status;
    this.braveMessage = opts.braveMessage;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

export class BraveRateGateTimeoutError extends Error {
  readonly maxWaitMs: number;

  constructor(message: string, opts: { maxWaitMs: number }) {
    super(message);
    this.name = 'BraveRateGateTimeoutError';
    this.maxWaitMs = opts.maxWaitMs;
  }
}

export function isBraveHttpError(err: unknown): err is BraveHttpError {
  return err instanceof BraveHttpError;
}

export function isBraveRateGateTimeoutError(err: unknown): err is BraveRateGateTimeoutError {
  return err instanceof BraveRateGateTimeoutError;
}

