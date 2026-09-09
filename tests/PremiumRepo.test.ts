import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb, type TestDb } from './_helpers/db';
import { PremiumRepo } from '../src/database/repositories/PremiumRepo';

let tdb: TestDb;
let prem: PremiumRepo;

beforeEach(() => {
  tdb = makeTestDb();
  prem = new PremiumRepo(tdb.db);
});

afterEach(() => {
  tdb.cleanup();
});

describe('PremiumRepo', () => {
  describe('user premium', () => {
    it('is not premium by default', () => {
      expect(prem.isUserPremium('u1')).toBe(false);
    });

    it('returns false after permanent grant has no expiry (still not expired)', () => {
      prem.grantUserPremium('u1', 'admin', null, 'lifetime');
      const p = prem.isUserPremium('u1') as { isPermanent: boolean; reason: string };
      expect(p).toBeTruthy();
      expect(p.isPermanent).toBe(true);
      expect(p.reason).toBe('lifetime');
    });

    it('returns true for a future expiry', () => {
      const future = Date.now() + 60_000;
      prem.grantUserPremium('u1', 'admin', future, 'sub');
      const p = prem.isUserPremium('u1') as { isPermanent: boolean; expiresAt: number };
      expect(p.isPermanent).toBe(false);
      expect(p.expiresAt).toBe(future);
    });

    it('returns false once the expiry has passed', () => {
      prem.grantUserPremium('u1', 'admin', Date.now() - 1_000, 'sub');
      expect(prem.isUserPremium('u1')).toBe(false);
    });

    it('revokeUserPremium flips active to 0', () => {
      prem.grantUserPremium('u1', 'admin', null, 'sub');
      prem.revokeUserPremium('u1');
      expect(prem.isUserPremium('u1')).toBe(false);
    });
  });

  describe('guild premium', () => {
    it('is not premium by default', () => {
      expect(prem.isGuildPremium('g1')).toBe(false);
    });

    it('round-trips a grant', () => {
      prem.grantGuildPremium('g1', 'admin', null, 'gift');
      const p = prem.isGuildPremium('g1') as { type: string; isPermanent: boolean };
      expect(p.type).toBe('guild');
      expect(p.isPermanent).toBe(true);
    });
  });

  describe('hasAnyPremium', () => {
    it('prefers user over guild premium', () => {
      prem.grantUserPremium('u1', 'admin', null, 'user-grant');
      prem.grantGuildPremium('g1', 'admin', null, 'guild-grant');
      const any = prem.hasAnyPremium('u1', 'g1') as { type: string };
      expect(any.type).toBe('user');
    });

    it('falls back to guild premium when user is not premium', () => {
      prem.grantGuildPremium('g1', 'admin', null, 'guild-grant');
      const any = prem.hasAnyPremium('u1', 'g1') as { type: string };
      expect(any.type).toBe('guild');
    });

    it('returns false when neither is premium', () => {
      expect(prem.hasAnyPremium('u1', 'g1')).toBe(false);
    });
  });

  describe('cleanupExpired', () => {
    it('revokes expired users and guilds, reports counts', () => {
      vi.useFakeTimers();
      const now = Date.now();
      // expired user
      prem.grantUserPremium('u1', 'admin', now - 1_000, 'expired');
      // active user
      prem.grantUserPremium('u2', 'admin', now + 60_000, 'active');
      // expired guild
      prem.grantGuildPremium('g1', 'admin', now - 1_000, 'expired');
      // active guild
      prem.grantGuildPremium('g2', 'admin', now + 60_000, 'active');

      const result = prem.cleanupExpired() as { usersRevoked: number; guildsRevoked: number; total: number };
      expect(result.usersRevoked).toBe(1);
      expect(result.guildsRevoked).toBe(1);
      expect(result.total).toBe(2);

      expect(prem.isUserPremium('u1')).toBe(false);
      expect(prem.isUserPremium('u2')).toBeTruthy();
      expect(prem.isGuildPremium('g1')).toBe(false);
      expect(prem.isGuildPremium('g2')).toBeTruthy();
      vi.useRealTimers();
    });
  });

  describe('extendPremium', () => {
    it('returns false for a non-existent user', () => {
      expect(prem.extendPremium('user', 'u1', 60_000)).toBe(false);
    });

    it('extends a time-limited premium by the additional window', () => {
      const start = Date.now() + 10_000;
      prem.grantUserPremium('u1', 'admin', start, 'sub');
      const extended = prem.extendPremium('user', 'u1', 60_000) as { expiresAt: number };
      expect(extended.expiresAt).toBe(start + 60_000);
    });

    it('extends from "now" when a permanent premium gets a finite expiry', () => {
      prem.grantUserPremium('u1', 'admin', null, 'lifetime');
      const extended = prem.extendPremium('user', 'u1', 60_000) as { expiresAt: number; isPermanent: boolean };
      expect(extended.isPermanent).toBe(false);
      expect(extended.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('getStats', () => {
    it('reports zeros for a clean db', () => {
      const s = prem.getStats() as { active: { total: number }; total: { total: number }; expired: { total: number } };
      expect(s.active.total).toBe(0);
      expect(s.total.total).toBe(0);
      expect(s.expired.total).toBe(0);
    });

    it('counts active and total separately', () => {
      prem.grantUserPremium('u1', 'admin', null, 'perm');
      prem.grantUserPremium('u2', 'admin', Date.now() - 1_000, 'expired');
      const s = prem.getStats() as { active: { users: number }; total: { users: number } };
      expect(s.active.users).toBe(1);
      expect(s.total.users).toBe(2);
    });
  });
});
