import type { PrismaClient, BraveKey } from '@mcp-nexus/db';
import { orderKeyCandidates, type TavilyKeySelectionStrategy } from '@mcp-nexus/core';
import { decryptAes256Gcm } from '../crypto/crypto.js';

type EligibleKey = BraveKey & { apiKey: string };

class Mutex {
  private current: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const prev = this.current;
    this.current = prev.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export class BraveKeyPool {
  private readonly prisma: PrismaClient;
  private readonly encryptionKey: Buffer;
  private readonly getSelectionStrategy: () => Promise<TavilyKeySelectionStrategy>;
  private readonly mutex = new Mutex();

  constructor(opts: {
    prisma: PrismaClient;
    encryptionKey: Buffer;
    getSelectionStrategy: () => Promise<TavilyKeySelectionStrategy>;
  }) {
    this.prisma = opts.prisma;
    this.encryptionKey = opts.encryptionKey;
    this.getSelectionStrategy = opts.getSelectionStrategy;
  }

  async selectEligibleKey(): Promise<EligibleKey | null> {
    return await this.mutex.runExclusive(async () => {
      const selectionStrategy = await this.getSelectionStrategy();
      const now = new Date();

      const keys = await this.prisma.braveKey.findMany({
        where: { status: 'active' },
        orderBy: [{ failureScore: 'asc' }, { lastUsedAt: 'asc' }, { createdAt: 'asc' }],
        take: 20
      });

      if (keys.length === 0) return null;

      const lowestFailureScore = Math.min(...keys.map((key) => key.failureScore));
      const preferred = keys.filter((key) => key.failureScore === lowestFailureScore);
      const chosen = orderKeyCandidates(preferred, selectionStrategy)[0]!;

      const updated = await this.prisma.braveKey.update({
        where: { id: chosen.id },
        data: { lastUsedAt: now }
      });

      const apiKey = decryptAes256Gcm(Buffer.from(updated.keyEncrypted), this.encryptionKey);
      return { ...updated, apiKey };
    });
  }

  async markInvalid(keyId: string): Promise<void> {
    await this.prisma.braveKey.update({
      where: { id: keyId },
      data: { status: 'invalid' }
    });
  }

  async incrementFailureScore(keyId: string): Promise<void> {
    await this.prisma.braveKey.update({
      where: { id: keyId },
      data: {
        failureScore: { increment: 1 }
      }
    });
  }
}
