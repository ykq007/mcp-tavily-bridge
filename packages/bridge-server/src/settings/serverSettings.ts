import type { PrismaClient } from '@mcp-nexus/db';
import { parseTavilyKeySelectionStrategy, parseSearchSourceMode, type TavilyKeySelectionStrategy, type SearchSourceMode } from '@mcp-nexus/core';

const REFRESH_MS = Number(process.env.SERVER_SETTINGS_REFRESH_MS ?? '5000');
const KEY_TAVILY_STRATEGY = 'tavilyKeySelectionStrategy';
const KEY_SEARCH_SOURCE_MODE = 'searchSourceMode';
const KEY_RESEARCH_ENABLED = 'researchEnabled';

export class ServerSettings {
  private readonly prisma: PrismaClient;
  private readonly fallbackStrategy: TavilyKeySelectionStrategy;
  private readonly fallbackSearchSourceMode: SearchSourceMode;
  private readonly fallbackResearchEnabled: boolean;
  private cached: { strategy: TavilyKeySelectionStrategy; expiresAtMs: number } | null = null;
  private cachedSearchSourceMode: { mode: SearchSourceMode; expiresAtMs: number } | null = null;
  private cachedResearchEnabled: { enabled: boolean; expiresAtMs: number } | null = null;
  private inFlight: Promise<TavilyKeySelectionStrategy> | null = null;
  private inFlightSearchSourceMode: Promise<SearchSourceMode> | null = null;
  private inFlightResearchEnabled: Promise<boolean> | null = null;

  constructor(opts: { prisma: PrismaClient; fallbackStrategy: TavilyKeySelectionStrategy; fallbackSearchSourceMode?: SearchSourceMode; fallbackResearchEnabled?: boolean }) {
    this.prisma = opts.prisma;
    this.fallbackStrategy = opts.fallbackStrategy;
    this.fallbackSearchSourceMode = opts.fallbackSearchSourceMode ?? 'brave_prefer_tavily_fallback';
    this.fallbackResearchEnabled = opts.fallbackResearchEnabled ?? true;
  }

  async getTavilyKeySelectionStrategy(): Promise<TavilyKeySelectionStrategy> {
    const now = Date.now();
    if (this.cached && now < this.cached.expiresAtMs) return this.cached.strategy;
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      try {
        const row = await this.prisma.serverSetting.findUnique({ where: { key: KEY_TAVILY_STRATEGY } });
        const parsed = parseTavilyKeySelectionStrategy(row?.value, this.fallbackStrategy);
        this.cached = { strategy: parsed, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
        return parsed;
      } catch {
        const fallback = this.cached?.strategy ?? this.fallbackStrategy;
        this.cached = { strategy: fallback, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
        return fallback;
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }

  async setTavilyKeySelectionStrategy(next: TavilyKeySelectionStrategy): Promise<TavilyKeySelectionStrategy> {
    await this.prisma.serverSetting.upsert({
      where: { key: KEY_TAVILY_STRATEGY },
      create: { key: KEY_TAVILY_STRATEGY, value: next },
      update: { value: next }
    });
    this.cached = { strategy: next, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
    return next;
  }

  async getSearchSourceMode(): Promise<SearchSourceMode> {
    const now = Date.now();
    if (this.cachedSearchSourceMode && now < this.cachedSearchSourceMode.expiresAtMs) {
      return this.cachedSearchSourceMode.mode;
    }
    if (this.inFlightSearchSourceMode) return this.inFlightSearchSourceMode;

    this.inFlightSearchSourceMode = (async () => {
      try {
        const row = await this.prisma.serverSetting.findUnique({ where: { key: KEY_SEARCH_SOURCE_MODE } });
        const parsed = parseSearchSourceMode(row?.value, this.fallbackSearchSourceMode);
        this.cachedSearchSourceMode = { mode: parsed, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
        return parsed;
      } catch {
        const fallback = this.cachedSearchSourceMode?.mode ?? this.fallbackSearchSourceMode;
        this.cachedSearchSourceMode = { mode: fallback, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
        return fallback;
      } finally {
        this.inFlightSearchSourceMode = null;
      }
    })();

    return this.inFlightSearchSourceMode;
  }

  async setSearchSourceMode(next: SearchSourceMode): Promise<SearchSourceMode> {
    await this.prisma.serverSetting.upsert({
      where: { key: KEY_SEARCH_SOURCE_MODE },
      create: { key: KEY_SEARCH_SOURCE_MODE, value: next },
      update: { value: next }
    });
    this.cachedSearchSourceMode = { mode: next, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
    return next;
  }

  async getResearchEnabled(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedResearchEnabled && now < this.cachedResearchEnabled.expiresAtMs) {
      return this.cachedResearchEnabled.enabled;
    }
    if (this.inFlightResearchEnabled) return this.inFlightResearchEnabled;

    this.inFlightResearchEnabled = (async () => {
      try {
        const row = await this.prisma.serverSetting.findUnique({ where: { key: KEY_RESEARCH_ENABLED } });
        const enabled = row?.value === 'false' ? false : (row?.value === 'true' ? true : this.fallbackResearchEnabled);
        this.cachedResearchEnabled = { enabled, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
        return enabled;
      } catch {
        const fallback = this.cachedResearchEnabled?.enabled ?? this.fallbackResearchEnabled;
        this.cachedResearchEnabled = { enabled: fallback, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
        return fallback;
      } finally {
        this.inFlightResearchEnabled = null;
      }
    })();

    return this.inFlightResearchEnabled;
  }

  async setResearchEnabled(next: boolean): Promise<boolean> {
    await this.prisma.serverSetting.upsert({
      where: { key: KEY_RESEARCH_ENABLED },
      create: { key: KEY_RESEARCH_ENABLED, value: String(next) },
      update: { value: String(next) }
    });
    this.cachedResearchEnabled = { enabled: next, expiresAtMs: Date.now() + Math.max(250, REFRESH_MS) };
    return next;
  }
}

