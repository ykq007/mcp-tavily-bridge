import http from 'node:http';

import { createBridgeApp } from './app.js';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? '8787');
const app = createBridgeApp({ host: HOST });

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`bridge-server listening on http://${HOST}:${PORT}`);
});
