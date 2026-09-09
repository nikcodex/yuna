import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb, type TestDb } from './_helpers/db';
import { CooldownRepo } from '../src/database/repositories/CooldownRepo';

let tdb: TestDb;
let cooldowns: CooldownRepo;

beforeEach(() => {
  tdb = makeTestDb();
  cooldowns = new CooldownRepo(tdb.db);
});

afterEach(() => {
  tdb.cleanup();
});

describe('CooldownRepo', () => {
  describe('get', () => {
    it('returns null for an unknown key', () => {
      expect(cooldowns.get('u1', 'play', 'g1')).toBeNull();
    });

    it('returns the row after set is called', () => {
      cooldowns.set('u1', 'play', 'g1', 5_000);
      const row = cooldowns.get('u1', 'play', 'g1') as { key: string; user_id: string };
      expect(row).not.toBeNull();
      expect(row.key).toBe('u1:play:g1');
      expect(row.user_id).toBe('u1');
    });

    it('keys are scoped per (user, command, guild) tuple', () => {
      cooldowns.set('u1', 'play', 'g1', 5_000);
      expect(cooldowns.get('u1', 'play', 'g2')).toBeNull();
      expect(cooldowns.get('u2', 'play', 'g1')).toBeNull();
    });

    it('upsert overwrites the prior last_used for the same key', () => {
      cooldowns.set('u1', 'play', 'g1', 1_000);
      const first = cooldowns.get('u1', 'play', 'g1') as { last_used: number };
      // bump time
      vi.useFakeTimers();
      vi.advanceTimersByTime(2_000);
      cooldowns.set('u1', 'play', 'g1', 1_000);
      const second = cooldowns.get('u1', 'play', 'g1') as { last_used: number };
      expect(second.last_used).toBeGreaterThan(first.last_used);
      vi.useRealTimers();
    });
  });

  describe('expiry', () => {
    it('returns null once the cooldown has expired', () => {
      vi.useFakeTimers();
      cooldowns.set('u1', 'play', 'g1', 1_000);
      expect(cooldowns.get('u1', 'play', 'g1')).not.toBeNull();
      vi.advanceTimersByTime(1_500);
      expect(cooldowns.get('u1', 'play', 'g1')).toBeNull();
      vi.useRealTimers();
    });

    it('purgeExpired removes rows past their expires_at', () => {
      vi.useFakeTimers();
      cooldowns.set('u1', 'play', 'g1', 1_000);
      cooldowns.set('u1', 'skip', 'g1', 60_000);
      vi.advanceTimersByTime(1_500);
      cooldowns.purgeExpired();
      expect(cooldowns.get('u1', 'play', 'g1')).toBeNull();
      expect(cooldowns.get('u1', 'skip', 'g1')).not.toBeNull();
      vi.useRealTimers();
    });
  });

  describe('violations', () => {
    it('increments the violation count on each call', () => {
      vi.useFakeTimers();
      cooldowns.set('u1', 'play', 'g1', 1_000);
      const v1 = cooldowns.recordViolation('u1', 'play', 'g1', 60_000);
      const v2 = cooldowns.recordViolation('u1', 'play', 'g1', 60_000);
      const v3 = cooldowns.recordViolation('u1', 'play', 'g1', 60_000);
      expect(v1).toBe(1);
      expect(v2).toBe(2);
      expect(v3).toBe(3);
      vi.useRealTimers();
    });

    it('drops violation timestamps outside the rolling window', () => {
      vi.useFakeTimers();
      cooldowns.set('u1', 'play', 'g1', 1_000);
      cooldowns.recordViolation('u1', 'play', 'g1', 10_000);
      cooldowns.recordViolation('u1', 'play', 'g1', 10_000);
      vi.advanceTimersByTime(15_000);
      const after = cooldowns.recordViolation('u1', 'play', 'g1', 10_000);
      // After the 15s jump, prior two timestamps are outside the 10s window,
      // so only this latest one counts. The violation_count column is still
      // cumulative (it never decays on its own), so it equals 3.
      expect(after).toBe(3);
      vi.useRealTimers();
    });

    it('reset clears the count and timestamps', () => {
      cooldowns.set('u1', 'play', 'g1', 1_000);
      cooldowns.recordViolation('u1', 'play', 'g1', 60_000);
      cooldowns.recordViolation('u1', 'play', 'g1', 60_000);
      cooldowns.reset('u1', 'play', 'g1');
      const row = cooldowns.get('u1', 'play', 'g1') as { violation_count: number; violation_timestamps: string };
      expect(row.violation_count).toBe(0);
      expect(JSON.parse(row.violation_timestamps)).toEqual([]);
    });
  });
});
