export class TavilyHttpError extends Error {
  public readonly status: number;
  public readonly tavilyMessage?: string;

  constructor(message: string, opts: { status: number; tavilyMessage?: string }) {
    super(message);
    this.name = 'TavilyHttpError';
    this.status = opts.status;
    this.tavilyMessage = opts.tavilyMessage;
  }
}

export function isTavilyHttpError(error: unknown): error is TavilyHttpError {
  return error instanceof TavilyHttpError;
}

