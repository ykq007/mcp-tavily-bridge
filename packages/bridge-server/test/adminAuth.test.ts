import { describe, expect, it, vi } from 'vitest';
import { requireAdminToken } from '../src/admin/adminAuth.js';

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('adminAuth', () => {
  it('returns 500 when ADMIN_API_TOKEN is missing', () => {
    const prev = process.env.ADMIN_API_TOKEN;
    delete process.env.ADMIN_API_TOKEN;

    const handler = requireAdminToken();
    const req: any = { headers: {} };
    const res = createRes();
    const next = vi.fn();

    handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('ADMIN_API_TOKEN')
      })
    );
    expect(next).not.toHaveBeenCalled();

    if (typeof prev === 'string') process.env.ADMIN_API_TOKEN = prev;
  });

  it('returns 401 when token is wrong', () => {
    const prev = process.env.ADMIN_API_TOKEN;
    process.env.ADMIN_API_TOKEN = 'secret';

    const handler = requireAdminToken();
    const req: any = { headers: { authorization: 'Bearer wrong' } };
    const res = createRes();
    const next = vi.fn();

    handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();

    if (typeof prev === 'string') process.env.ADMIN_API_TOKEN = prev;
    else delete process.env.ADMIN_API_TOKEN;
  });

  it('calls next when token matches', () => {
    const prev = process.env.ADMIN_API_TOKEN;
    process.env.ADMIN_API_TOKEN = 'secret';

    const handler = requireAdminToken();
    const req: any = { headers: { authorization: 'Bearer secret' } };
    const res = createRes();
    const next = vi.fn();

    handler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    if (typeof prev === 'string') process.env.ADMIN_API_TOKEN = prev;
    else delete process.env.ADMIN_API_TOKEN;
  });
});

