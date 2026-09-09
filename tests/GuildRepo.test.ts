import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from './_helpers/db';
import { GuildRepo } from '../src/database/repositories/GuildRepo';
import { config } from '../src/config/config';

let tdb: TestDb;
let guilds: GuildRepo;

beforeEach(() => {
  tdb = makeTestDb();
  guilds = new GuildRepo(tdb.db);
});

afterEach(() => {
  tdb.cleanup();
});

describe('GuildRepo', () => {
  describe('getGuild / ensureGuild', () => {
    it('returns undefined for an unknown guild', () => {
      expect(guilds.getGuild('g-missing')).toBeUndefined();
    });

    it('ensureGuild creates the row with sensible defaults', () => {
      const row = guilds.ensureGuild('g1') as { id: string; default_volume: number; stay_247: number | boolean };
      expect(row.id).toBe('g1');
      expect(row.default_volume).toBe(100);
      expect(!!row.stay_247).toBe(false);
    });

    it('ensureGuild is idempotent (returns the existing row)', () => {
      guilds.ensureGuild('g1');
      guilds.ensureGuild('g1');
      const row = guilds.getGuild('g1') as { id: string };
      expect(row.id).toBe('g1');
    });

    it('ensureGuild throws when called with an empty id', () => {
      expect(() => guilds.ensureGuild('')).toThrow();
    });
  });

  describe('volume', () => {
    it('defaults to 100', () => {
      guilds.ensureGuild('g1');
      expect(guilds.getDefaultVolume('g1')).toBe(100);
    });

    it('rejects volumes outside 1..100', () => {
      guilds.ensureGuild('g1');
      expect(() => guilds.setDefaultVolume('g1', 0)).toThrow();
      expect(() => guilds.setDefaultVolume('g1', 101)).toThrow();
    });

    it('persists valid volumes', () => {
      guilds.ensureGuild('g1');
      guilds.setDefaultVolume('g1', 42);
      expect(guilds.getDefaultVolume('g1')).toBe(42);
    });
  });

  describe('blacklist', () => {
    it('returns false by default (not blacklisted)', () => {
      guilds.ensureGuild('g1');
      expect(guilds.isBlacklisted('g1')).toBe(false);
    });

    it('returns an object with reason after blacklistGuild', () => {
      guilds.ensureGuild('g1');
      guilds.blacklistGuild('g1', 'TOS');
      expect(guilds.isBlacklisted('g1')).toEqual({ blacklisted: true, reason: 'TOS' });
    });

    it('unblacklistGuild clears the flag', () => {
      guilds.ensureGuild('g1');
      guilds.blacklistGuild('g1', 'TOS');
      guilds.unblacklistGuild('g1');
      expect(guilds.isBlacklisted('g1')).toBe(false);
    });

    it('getAllBlacklistedGuilds returns only flagged guilds', () => {
      guilds.ensureGuild('g1');
      guilds.ensureGuild('g2');
      guilds.ensureGuild('g3');
      guilds.blacklistGuild('g2', 'spam');
      const list = guilds.getAllBlacklistedGuilds() as Array<{ id: string }>;
      expect(list.map((g) => g.id)).toEqual(['g2']);
    });
  });

  describe('24/7 (stay-in-voice)', () => {
    it('is off by default', () => {
      guilds.ensureGuild('g1');
      const s = guilds.get247Settings('g1') as { enabled: boolean; voiceChannel: string | null };
      expect(s.enabled).toBe(false);
      expect(s.voiceChannel).toBeNull();
    });

    it('set247Mode persists enabled + channels', () => {
      guilds.ensureGuild('g1');
      guilds.set247Mode('g1', true, 'voice-1', 'text-1');
      const s = guilds.get247Settings('g1') as { enabled: boolean; voiceChannel: string; textChannel: string };
      expect(s.enabled).toBe(true);
      expect(s.voiceChannel).toBe('voice-1');
      expect(s.textChannel).toBe('text-1');
    });

    it('getValid247Guilds returns only enabled guilds with a voice channel', () => {
      guilds.ensureGuild('g1');
      guilds.ensureGuild('g2');
      guilds.set247Mode('g1', true, 'voice-1', 'text-1');
      guilds.set247Mode('g2', true, null, null);
      const valid = guilds.getValid247Guilds() as Array<{ id: string }>;
      expect(valid.map((g) => g.id)).toEqual(['g1']);
    });
  });

  describe('prefixes', () => {
    it('falls back to the default config prefix when empty', () => {
      guilds.ensureGuild('g1');
      expect(guilds.getPrefixes('g1')).toEqual([config.prefix]);
    });

    it('round-trips a list of prefixes', () => {
      guilds.ensureGuild('g1');
      guilds.setPrefixes('g1', ['!', '?', '!!']);
      expect(guilds.getPrefixes('g1')).toEqual(['!', '?', '!!']);
    });
  });

  describe('sessions', () => {
    it('returns undefined when there is no active session', () => {
      expect(guilds.getActiveSession('g1')).toBeUndefined();
    });

    it('saveActiveSession then getActiveSession round-trips queue data', () => {
      const queue = [
        { identifier: 'a', title: 'A', author: 'X', uri: 'u', duration: 100, sourceName: 'yt' },
      ];
      guilds.saveActiveSession('g1', 'voice-1', 'text-1', { identifier: 'a', title: 'A' }, queue, 0);
      const session = guilds.getActiveSession('g1') as { voice_channel_id: string; queue_tracks: string };
      expect(session.voice_channel_id).toBe('voice-1');
      const parsed = JSON.parse(session.queue_tracks);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].identifier).toBe('a');
    });

    it('deleteActiveSession removes the row', () => {
      guilds.saveActiveSession('g1', 'voice-1', 'text-1', null, [], 0);
      expect(guilds.getActiveSession('g1')).toBeDefined();
      guilds.deleteActiveSession('g1');
      expect(guilds.getActiveSession('g1')).toBeUndefined();
    });

    it('getAllActiveSessions returns all stored sessions', () => {
      guilds.saveActiveSession('g1', 'v1', 't1', null, [], 0);
      guilds.saveActiveSession('g2', 'v2', 't2', null, [], 0);
      const sessions = guilds.getAllActiveSessions() as Array<{ guild_id: string }>;
      expect(sessions.map((s) => s.guild_id).sort()).toEqual(['g1', 'g2']);
    });
  });

  describe('auto-disconnect', () => {
    it('setAutoDisconnect persists the flag', () => {
      guilds.ensureGuild('g1');
      guilds.setAutoDisconnect('g1', false);
      const row = guilds.getGuild('g1') as { auto_disconnect: number | boolean };
      expect(!!row.auto_disconnect).toBe(false);
    });
  });
});
