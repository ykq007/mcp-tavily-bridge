import { describe, expect, it } from 'vitest';

import { createBridgeApp } from '../src/app.js';

describe('legacy /admin-ui route', () => {
  it('is unsupported (404)', async () => {
    const prevDb = process.env.DATABASE_URL;
    const prevKey = process.env.KEY_ENCRYPTION_SECRET;

    delete process.env.DATABASE_URL;
    delete process.env.KEY_ENCRYPTION_SECRET;

    const app = createBridgeApp();
    const server = app.listen(0);

    try {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('Expected server to be listening on a TCP port');
      }

      const res = await fetch(`http://127.0.0.1:${addr.port}/admin-ui`);
      expect(res.status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });

      if (typeof prevDb === 'string') process.env.DATABASE_URL = prevDb;
      else delete process.env.DATABASE_URL;
      if (typeof prevKey === 'string') process.env.KEY_ENCRYPTION_SECRET = prevKey;
      else delete process.env.KEY_ENCRYPTION_SECRET;
    }
  });
});
