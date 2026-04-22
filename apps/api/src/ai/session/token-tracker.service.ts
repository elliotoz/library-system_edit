import { Injectable, Logger } from '@nestjs/common';

export interface TokenUsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  recordedAt: Date;
}

export interface TokenUsageSummary {
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  cacheHitRate: number; // percentage
}

@Injectable()
export class TokenTrackerService {
  private readonly logger = new Logger(TokenTrackerService.name);
  // Key: `${userId}:${conversationId}` or `${userId}:global`
  private readonly records = new Map<string, TokenUsageRecord[]>();
  private readonly MAX_KEYS = 500;

  record(
    userId: string,
    conversationId: string | undefined,
    usage: {
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens?: number;
      cacheReadTokens?: number;
    },
  ): void {
    const key = `${userId}:${conversationId ?? 'global'}`;

    // Evict oldest key if at capacity
    if (!this.records.has(key) && this.records.size >= this.MAX_KEYS) {
      const firstKey = this.records.keys().next().value;
      if (firstKey !== undefined) this.records.delete(firstKey);
    }

    if (!this.records.has(key)) {
      this.records.set(key, []);
    }
    this.records.get(key)!.push({
      provider: usage.provider,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheCreationTokens: usage.cacheCreationTokens ?? 0,
      cacheReadTokens: usage.cacheReadTokens ?? 0,
      recordedAt: new Date(),
    });

    this.logger.debug(
      `[TOKENS] ${usage.provider}/${usage.model} in=${usage.inputTokens} out=${usage.outputTokens} ` +
      `cache_read=${usage.cacheReadTokens ?? 0} cache_create=${usage.cacheCreationTokens ?? 0}`,
    );
  }

  getSummary(userId: string, conversationId?: string): TokenUsageSummary {
    const key = `${userId}:${conversationId ?? 'global'}`;
    const entries = this.records.get(key) ?? [];

    const totalInputTokens = entries.reduce((s, e) => s + e.inputTokens, 0);
    const totalOutputTokens = entries.reduce((s, e) => s + e.outputTokens, 0);
    const totalCacheReadTokens = entries.reduce((s, e) => s + e.cacheReadTokens, 0);
    const totalCacheCreationTokens = entries.reduce((s, e) => s + e.cacheCreationTokens, 0);
    const totalSeen = totalInputTokens + totalCacheReadTokens;
    const cacheHitRate = totalSeen > 0 ? (totalCacheReadTokens / totalSeen) * 100 : 0;

    return {
      totalMessages: entries.length,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheCreationTokens,
      cacheHitRate: Math.round(cacheHitRate * 10) / 10,
    };
  }
}
