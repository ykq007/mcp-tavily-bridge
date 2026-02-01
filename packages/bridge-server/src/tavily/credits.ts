import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@mcp-tavily-bridge/db';
import { TavilyHttpError } from '@mcp-tavily-bridge/core';

export type TavilyCreditsSnapshot = {
  keyUsage: number | null;
  keyLimit: number | null;
  keyRemaining: number | null;
  accountPlanUsage: number | null;
  accountPlanLimit: number | null;
  accountPaygoUsage: number | null;
  accountPaygoLimit: number | null;
  accountRemaining: number | null;
  remaining: number | null;
  raw: unknown;
};

export async function fetchTavilyCredits(apiKey: string, opts: { timeoutMs: number }): Promise<TavilyCreditsSnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, opts.timeoutMs));
  try {
    const res = await fetch('https://api.tavily.com/usage', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal
    });

    const text = await res.text();
    const body = safeJson(text);

    if (!res.ok) {
      if (res.status === 401) throw new Error('Invalid API key');
      if (res.status === 429) throw new Error('Usage limit exceeded');
      const message = typeof (body as any)?.message === 'string' ? (body as any).message : res.statusText;
      throw new TavilyHttpError(`HTTP ${res.status}`, { status: res.status, tavilyMessage: message });
    }

    return parseUsage(body);
  } finally {
    clearTimeout(timer);
  }
}

export async function tryAcquireCreditsRefreshLock(prisma: PrismaClient, keyId: string, lockMs: number): Promise<string | null> {
  const now = new Date();
  const lockId = randomUUID();
  const until = new Date(now.getTime() + Math.max(1, lockMs));
  const updated = await prisma.tavilyKey.updateMany({
    where: {
      id: keyId,
      OR: [{ creditsRefreshLockUntil: null }, { creditsRefreshLockUntil: { lt: now } }]
    },
    data: {
      creditsRefreshLockUntil: until,
      creditsRefreshLockId: lockId
    }
  });
  return updated.count > 0 ? lockId : null;
}

export async function releaseCreditsRefreshLock(prisma: PrismaClient, keyId: string, lockId: string): Promise<void> {
  await prisma.tavilyKey.updateMany({
    where: { id: keyId, creditsRefreshLockId: lockId },
    data: { creditsRefreshLockUntil: null, creditsRefreshLockId: null }
  });
}

function parseUsage(raw: any): TavilyCreditsSnapshot {
  const keyUsage = numberOrNull(raw?.key?.usage);
  const keyLimit = numberOrNull(raw?.key?.limit);
  const keyRemaining = diffOrNull(keyLimit, keyUsage);

  const accountPlanUsage = numberOrNull(raw?.account?.plan_usage);
  const accountPlanLimit = numberOrNull(raw?.account?.plan_limit);
  const planRemaining = diffOrNull(accountPlanLimit, accountPlanUsage);

  const accountPaygoUsage = numberOrNull(raw?.account?.paygo_usage);
  const accountPaygoLimit = numberOrNull(raw?.account?.paygo_limit);
  const paygoRemaining = diffOrNull(accountPaygoLimit, accountPaygoUsage);

  const accountRemaining = sumNonNegative(planRemaining, paygoRemaining);
  const remaining = minDefined(keyRemaining, accountRemaining);

  return {
    keyUsage,
    keyLimit,
    keyRemaining,
    accountPlanUsage,
    accountPlanLimit,
    accountPaygoUsage,
    accountPaygoLimit,
    accountRemaining,
    remaining,
    raw
  };
}

function numberOrNull(v: any): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function diffOrNull(limit: number | null, usage: number | null): number | null {
  if (limit === null || usage === null) return null;
  return limit - usage;
}

function sumNonNegative(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  const av = a === null ? 0 : Math.max(0, a);
  const bv = b === null ? 0 : Math.max(0, b);
  return av + bv;
}

function minDefined(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
