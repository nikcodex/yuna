import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from './_helpers/db';
import { UserRepo } from '../src/database/repositories/UserRepo';

let tdb: TestDb;
let users: UserRepo;

beforeEach(() => {
  tdb = makeTestDb();
  users = new UserRepo(tdb.db);
});

afterEach(() => {
  tdb.cleanup();
});

describe('UserRepo', () => {
  describe('ensureUser / getUser', () => {
    it('returns null for an unknown user', () => {
      expect(users.getUser('missing')).toBeUndefined();
    });

    it('creates the row on ensureUser and returns it on subsequent get', () => {
      const created = users.ensureUser('u1') as { id: string };
      expect(created.id).toBe('u1');
      const fetched = users.getUser('u1') as { id: string };
      expect(fetched.id).toBe('u1');
    });

    it('ensureUser is idempotent', () => {
      users.ensureUser('u1');
      users.ensureUser('u1');
      const u = users.getUser('u1') as { id: string };
      expect(u.id).toBe('u1');
    });
  });

  describe('no-prefix', () => {
    it('is false by default', () => {
      expect(users.hasNoPrefix('u1')).toBe(false);
    });

    it('returns true after setNoPrefix(true)', () => {
      users.setNoPrefix('u1', true);
      expect(users.hasNoPrefix('u1')).toBe(true);
    });

    it('returns false after setNoPrefix(false)', () => {
      users.setNoPrefix('u1', true);
      users.setNoPrefix('u1', false);
      expect(users.hasNoPrefix('u1')).toBe(false);
    });
  });

  describe('autoplay cooldown', () => {
    it('returns 0 when unset', () => {
      expect(users.getAutoplayCooldown('u1')).toBe(0);
    });

    it('returns the timestamp while it is in the future', () => {
      const future = Date.now() + 60_000;
      users.setAutoplayCooldown('u1', future);
      expect(users.getAutoplayCooldown('u1')).toBe(future);
    });

    it('returns 0 when the cooldown is in the past', () => {
      users.setAutoplayCooldown('u1', Date.now() - 1_000);
      expect(users.getAutoplayCooldown('u1')).toBe(0);
    });
  });

  describe('custom prefixes', () => {
    it('returns an empty list by default', () => {
      expect(users.getUserPrefixes('u1')).toEqual([]);
    });

    it('round-trips a list of prefixes', () => {
      users.setUserPrefixes('u1', ['!', '?']);
      expect(users.getUserPrefixes('u1')).toEqual(['!', '?']);
    });

    it('caps the list at the configured limit', () => {
      users.setUserPrefixes('u1', ['a', 'b', 'c', 'd', 'e']);
      const stored = users.getUserPrefixes('u1');
      expect(stored.length).toBeLessThanOrEqual(3);
    });
  });

  describe('blacklist', () => {
    it('is not blacklisted by default', () => {
      expect(users.isBlacklisted('u1')).toBe(false);
    });

    it('returns a reason after blacklistUser', () => {
      users.blacklistUser('u1', 'spam');
      expect(users.isBlacklisted('u1')).toEqual({ blacklisted: true, reason: 'spam' });
    });

    it('unblacklistUser clears the flag', () => {
      users.blacklistUser('u1', 'spam');
      users.unblacklistUser('u1');
      expect(users.isBlacklisted('u1')).toBe(false);
    });
  });

  describe('history', () => {
    it('is empty by default', () => {
      expect(users.getHistory('u1')).toEqual([]);
    });

    it('round-trips a track', () => {
      users.addTrackToHistory('u1', {
        identifier: 'abc',
        title: 'Song',
        author: 'Artist',
        uri: 'https://example.com',
        duration: 1234,
        sourceName: 'youtube',
        artworkUrl: null,
      });
      const history = users.getHistory('u1') as Array<{ identifier: string; title: string }>;
      expect(history).toHaveLength(1);
      expect(history[0].identifier).toBe('abc');
      expect(history[0].title).toBe('Song');
    });

    it('skips entries without an identifier', () => {
      users.addTrackToHistory('u1', { title: 'no id' });
      expect(users.getHistory('u1')).toEqual([]);
    });

    it('moves an existing identifier to the top (de-dupes)', () => {
      users.addTrackToHistory('u1', { identifier: 'a', title: 'A' });
      users.addTrackToHistory('u1', { identifier: 'b', title: 'B' });
      users.addTrackToHistory('u1', { identifier: 'a', title: 'A (replayed)' });
      const history = users.getHistory('u1') as Array<{ identifier: string }>;
      expect(history[0].identifier).toBe('a');
      expect(history).toHaveLength(2);
    });

    it('caps the history at the configured limit', () => {
      for (let i = 0; i < 30; i++) {
        users.addTrackToHistory('u1', { identifier: `t${i}`, title: `T${i}` });
      }
      expect(users.getHistory('u1').length).toBeLessThanOrEqual(10);
    });
  });

  describe('spotify link', () => {
    it('returns null when not linked', () => {
      expect(users.getSpotifyProfile('u1')).toBeNull();
    });

    it('round-trips a profile link', () => {
      users.linkSpotifyProfile('u1', 'https://spotify.com/user/x', 'X');
      const profile = users.getSpotifyProfile('u1') as { profileUrl: string; displayName: string };
      expect(profile.profileUrl).toBe('https://spotify.com/user/x');
      expect(profile.displayName).toBe('X');
    });

    it('unlink clears the profile', () => {
      users.linkSpotifyProfile('u1', 'https://spotify.com/user/x', 'X');
      users.unlinkSpotifyProfile('u1');
      expect(users.getSpotifyProfile('u1')).toBeNull();
    });
  });
});
