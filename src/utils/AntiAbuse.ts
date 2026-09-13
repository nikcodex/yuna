import { logger } from '#utils/logger';
import { BloomFilter } from './BloomFilter';
import type { CooldownRepo } from '#database/repositories/CooldownRepo';

const VIOLATION_WINDOW_MS = 60_000;
const MAX_VIOLATIONS = 5;

/**
 * Centralized anti-abuse gating for Yuna.
 *
 * Cooldowns are persisted in the shared `command_cooldowns` SQLite table via
 * CooldownRepo, so enforcement is consistent across all shards and survives
 * restarts. The duplicate-message Bloom filter remains in-process: it is a
 * probabilistic dedup for one tick of recent messages and rebuilds quickly.
 */
export class AntiAbuse {
  public cooldowns = new Map<string, number>();
  public violations = new Map<string, number[]>();
  public blacklist = new Set<string>();
  public dupFilter: BloomFilter;

  constructor(private cooldownRepo?: CooldownRepo) {
    this.dupFilter = new BloomFilter(2048, 0.01);
  }

  /**
   * Checks whether (user, command, guild) is on cooldown.
   * Returns 0 if free, otherwise the remaining milliseconds.
   */
  getCooldown(userId: string, commandName: string, guildId: string): number {
    if (this.cooldownRepo) {
      const row = this.cooldownRepo.get(userId, commandName, guildId);
      if (!row) return 0;
      const remaining = row.expires_at - Date.now();
      return remaining > 0 ? remaining : 0;
    }
    const key = `${userId}:${commandName}:${guildId}`;
    const expires = this.cooldowns.get(key);
    if (!expires) return 0;
    const remaining = expires - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Records a successful command invocation and sets a cooldown of `ms` ms.
   * Resets any prior violation count for this (user, command, guild).
   */
  setCooldown(userId: string, commandName: string, guildId: string, ms: number) {
    if (this.cooldownRepo) {
      this.cooldownRepo.set(userId, commandName, guildId, ms);
      this.cooldownRepo.reset(userId, commandName, guildId);
      return;
    }
    const key = `${userId}:${commandName}:${guildId}`;
    this.cooldowns.set(key, Date.now() + ms);
    this.violations.delete(key);
  }

  /**
   * Records a cooldown violation. Returns the new violation count within the
   * rolling window, and auto-blacklists the (user, command, guild) key if it
   * crosses MAX_VIOLATIONS.
   */
  recordViolation(userId: string, commandName: string, guildId: string): number {
    const key = `${userId}:${commandName}:${guildId}`;
    const now = Date.now();
    const windowStart = now - VIOLATION_WINDOW_MS;
    const prior = (this.violations.get(key) ?? []).filter((t) => t >= windowStart);
    prior.push(now);
    this.violations.set(key, prior);

    if (this.cooldownRepo) {
      this.cooldownRepo.recordViolation(userId, commandName, guildId, VIOLATION_WINDOW_MS);
    }

    if (prior.length >= MAX_VIOLATIONS) {
      this.blacklist.add(key);
      logger.warn(
        'AntiAbuse',
        `Auto-blacklisted ${key} after ${prior.length} violations in ${VIOLATION_WINDOW_MS}ms`,
      );
    }
    return prior.length;
  }

  /**
   * Returns true if the (user, command, guild) is blacklisted for repeat
   * cooldown violations.
   */
  isBlacklisted(userId: string, commandName: string, guildId: string): boolean {
    return this.blacklist.has(`${userId}:${commandName}:${guildId}`);
  }

  clearBlacklist(userId: string, commandName: string, guildId: string) {
    this.blacklist.delete(`${userId}:${commandName}:${guildId}`);
  }

  /**
   * Tracks a recently-seen token (e.g. message content hash) and reports
   * whether it has been seen before. The filter is intentionally approximate;
   * a false positive is acceptable, a false negative is not for our use.
   */
  seenRecently(token: string): boolean {
    if (this.dupFilter.has(token)) return true;
    this.dupFilter.add(token);
    return false;
  }
}

// Made by Nikhil Under CodeX Devs
