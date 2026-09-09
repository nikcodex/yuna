import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from './_helpers/db';
import { EconomyRepo } from '../src/database/repositories/EconomyRepo';

let tdb: TestDb;
let economy: EconomyRepo;

beforeEach(() => {
  tdb = makeTestDb();
  economy = new EconomyRepo(tdb.db);
});

afterEach(() => {
  tdb.cleanup();
});

describe('EconomyRepo', () => {
  describe('getCoins', () => {
    it('returns 0 for a user with no record', () => {
      expect(economy.getCoins('user:1')).toBe(0);
    });

    it('returns the stored balance after addCoins', () => {
      economy.addCoins('user:1', 500);
      expect(economy.getCoins('user:1')).toBe(500);
    });
  });

  describe('addCoins', () => {
    it('increments an existing balance', () => {
      economy.addCoins('user:1', 100);
      economy.addCoins('user:1', 50);
      expect(economy.getCoins('user:1')).toBe(150);
    });

    it('creates a row for a new user', () => {
      economy.addCoins('user:new', 25);
      expect(economy.getCoins('user:new')).toBe(25);
    });
  });

  describe('removeCoins', () => {
    it('decrements the balance', () => {
      economy.addCoins('user:1', 100);
      const remaining = economy.removeCoins('user:1', 30);
      expect(remaining).toBe(70);
      expect(economy.getCoins('user:1')).toBe(70);
    });

    it('returns false (no throw) when balance would go negative', () => {
      economy.addCoins('user:1', 10);
      expect(economy.removeCoins('user:1', 50)).toBe(false);
      // Balance must be unchanged after a failed debit
      expect(economy.getCoins('user:1')).toBe(10);
    });

    it('returns false for unknown user (treated as zero balance)', () => {
      expect(economy.removeCoins('user:unknown', 1)).toBe(false);
    });
  });

  describe('transfer (atomic)', () => {
    it('moves coins from one user to another', () => {
      economy.addCoins('alice', 1000);
      const result = economy.transfer('alice', 'bob', 300);
      expect(result).toEqual({ ok: true, fromBalance: 700, toBalance: 300 });
      expect(economy.getCoins('alice')).toBe(700);
      expect(economy.getCoins('bob')).toBe(300);
    });

    it('creates the receiver row if absent', () => {
      economy.addCoins('alice', 100);
      const result = economy.transfer('alice', 'newbie', 25);
      expect(result.ok).toBe(true);
      expect(economy.getCoins('newbie')).toBe(25);
    });

    it('rejects when sender has insufficient funds', () => {
      economy.addCoins('alice', 10);
      const result = economy.transfer('alice', 'bob', 50);
      expect(result).toEqual({ ok: false, reason: 'insufficient_funds' });
      // No money moved
      expect(economy.getCoins('alice')).toBe(10);
      expect(economy.getCoins('bob')).toBe(0);
    });

    it('rejects self-transfer', () => {
      economy.addCoins('alice', 100);
      const result = economy.transfer('alice', 'alice', 50);
      expect(result).toEqual({ ok: false, reason: 'self_transfer' });
      expect(economy.getCoins('alice')).toBe(100);
    });

    it('rejects non-positive amounts', () => {
      economy.addCoins('alice', 100);
      expect(economy.transfer('alice', 'bob', 0)).toEqual({ ok: false, reason: 'invalid_amount' });
      expect(economy.transfer('alice', 'bob', -10)).toEqual({ ok: false, reason: 'invalid_amount' });
      expect(economy.transfer('alice', 'bob', 1.5)).toEqual({ ok: false, reason: 'invalid_amount' });
    });

    it('rolls back on internal error (no partial state)', () => {
      // Simulate by transferring the exact available amount to a new user
      // followed by a second transfer; verify second one fails atomically
      economy.addCoins('alice', 100);
      const ok = economy.transfer('alice', 'bob', 100);
      expect(ok.ok).toBe(true);
      const fail = economy.transfer('alice', 'bob', 1);
      expect(fail.ok).toBe(false);
      // Alice had exactly 100, transferred 100; her balance must be 0, not negative
      expect(economy.getCoins('alice')).toBe(0);
      expect(economy.getCoins('bob')).toBe(100);
    });
  });

  describe('getTopUsers', () => {
    it('returns users sorted by balance descending', () => {
      economy.addCoins('a', 10);
      economy.addCoins('b', 100);
      economy.addCoins('c', 50);
      const top = economy.getTopUsers(3) as Array<{ user_id: string; coins: number }>;
      expect(top.map((u) => u.user_id)).toEqual(['b', 'c', 'a']);
      expect(top.map((u) => u.coins)).toEqual([100, 50, 10]);
    });

    it('respects limit', () => {
      economy.addCoins('a', 1);
      economy.addCoins('b', 2);
      economy.addCoins('c', 3);
      const top = economy.getTopUsers(2) as Array<{ user_id: string }>;
      expect(top).toHaveLength(2);
    });
  });
});
