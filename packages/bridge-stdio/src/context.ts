import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  clientTokenId: string;
  clientTokenPrefix: string;
  rawClientToken: string;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();


