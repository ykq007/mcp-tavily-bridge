import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  clientTokenId: string;
  clientTokenPrefix: string;
  rawClientToken: string;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function requireRequestContext(): RequestContext {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('RequestContext is missing');
  return ctx;
}

