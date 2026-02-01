import type { PrismaClient, TavilyKey } from '@mcp-tavily-bridge/db';
import { decryptAes256Gcm } from '../crypto/crypto.js';

type EligibleKey = TavilyKey & { apiKey: string };

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

export class TavilyKeyPool {
  private readonly prisma: PrismaClient;
  private readonly encryptionKey: Buffer;
  private readonly mutex = new Mutex();

  constructor(opts: { prisma: PrismaClient; encryptionKey: Buffer }) {
    this.prisma = opts.prisma;
    this.encryptionKey = opts.encryptionKey;
  }

  async selectEligibleKey(): Promise<EligibleKey | null> {
    return await this.mutex.runExclusive(async () => {
      const now = new Date();
      const keys = await this.prisma.tavilyKey.findMany({
        where: { status: 'active', OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }] },
        orderBy: [{ lastUsedAt: 'asc' }, { createdAt: 'asc' }],
        take: 10
      });
      if (keys.length === 0) return null;
      const chosen = keys[0]!;
      await this.prisma.tavilyKey.update({ where: { id: chosen.id }, data: { lastUsedAt: now } });
      const apiKey = decryptAes256Gcm(Buffer.from(chosen.keyEncrypted), this.encryptionKey);
      return { ...chosen, apiKey };
    });
  }

  async markCooldown(keyId: string, cooldownUntil: Date): Promise<void> {
    await this.prisma.tavilyKey.update({ where: { id: keyId }, data: { status: 'cooldown', cooldownUntil } });
  }

  async markInvalid(keyId: string): Promise<void> {
    await this.prisma.tavilyKey.update({ where: { id: keyId }, data: { status: 'invalid' } });
  }
}

