import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  clientTokenId: string;
  clientTokenPrefix: string;
  rawClientToken: string;
  allowedTools?: unknown;  // Phase 3.4: Tool scoping
  defaultParametersHeader?: string;
  ip?: string;
  userAgent?: string;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();


