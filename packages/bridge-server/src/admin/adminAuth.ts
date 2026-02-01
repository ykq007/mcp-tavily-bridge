import type { RequestHandler } from 'express';

export function requireAdminToken(): RequestHandler {
  return (req, res, next) => {
    const adminToken = process.env.ADMIN_API_TOKEN;
    if (!adminToken) {
      res.status(500).json({
        error: 'Server misconfigured: ADMIN_API_TOKEN is required to use admin endpoints.'
      });
      return;
    }
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token || token !== adminToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };
}
