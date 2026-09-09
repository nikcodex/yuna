import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from './_helpers/db';
import { StatsRepo } from '../src/database/repositories/StatsRepo';

let tdb: TestDb;
let stats: StatsRepo;

beforeEach(() => {
  tdb = makeTestDb();
  stats = new StatsRepo(tdb.db);
});

afterEach(() => {
  tdb.cleanup();
});

const track = (id: string, opts: { author?: string; source?: string; duration?: number } = {}) => ({
  identifier: id,
  title: `Title ${id}`,
  author: opts.author ?? 'Artist',
  uri: `https://example.com/${id}`,
  duration: opts.duration ?? 60_000,
  sourceName: opts.source ?? 'youtube',
  artworkUrl: null,
});

describe('StatsRepo', () => {
  describe('logTrackPlay / getUserStats', () => {
    it('creates the user row on first log', () => {
      stats.logTrackPlay('u1', track('a'));
      const s = stats.getUserStats('u1') as { user_id: string; total_tracks_played: number };
      expect(s.user_id).toBe('u1');
      expect(s.total_tracks_played).toBe(1);
    });

    it('increments total_tracks_played per play', () => {
      stats.logTrackPlay('u1', track('a'));
      stats.logTrackPlay('u1', track('b'));
      stats.logTrackPlay('u1', track('c'));
      const s = stats.getUserStats('u1') as { total_tracks_played: number };
      expect(s.total_tracks_played).toBe(3);
    });
  });

  describe('addListenTime', () => {
    it('accumulates listen time', () => {
      stats.addListenTime('u1', 30_000);
      stats.addListenTime('u1', 70_000);
      const s = stats.getUserStats('u1') as { total_listen_time_ms: number };
      expect(s.total_listen_time_ms).toBe(100_000);
    });
  });

  describe('getTopArtists / getTopTracks / getTopSources', () => {
    beforeEach(() => {
      stats.logTrackPlay('u1', track('a', { author: 'A' }));
      stats.logTrackPlay('u1', track('b', { author: 'A' }));
      stats.logTrackPlay('u1', track('c', { author: 'B' }));
      stats.logTrackPlay('u1', track('d', { source: 'spotify' }));
    });

    it('getTopArtists returns artists ordered by play count', () => {
      const top = stats.getTopArtists('u1', '1970-01-01', 5) as Array<{ artist: string; play_count: number }>;
      expect(top[0]).toEqual({ artist: 'A', play_count: 2, artwork: null });
      expect(top[1]).toEqual({ artist: 'B', play_count: 1, artwork: null });
    });

    it('getTopTracks groups by identifier', () => {
      stats.logTrackPlay('u1', track('a', { author: 'A' }));
      const top = stats.getTopTracks('u1', '1970-01-01', 5) as Array<{ title: string; play_count: number }>;
      const aRow = top.find((t) => t.title === 'Title a');
      expect(aRow?.play_count).toBe(2);
    });

    it('getTopSources groups by source name', () => {
      const top = stats.getTopSources('u1', '1970-01-01', 5) as Array<{ source: string; play_count: number }>;
      const yt = top.find((s) => s.source === 'youtube');
      const sp = top.find((s) => s.source === 'spotify');
      expect(yt?.play_count).toBe(3);
      expect(sp?.play_count).toBe(1);
    });

    it('getTopArtists respects the limit', () => {
      const top = stats.getTopArtists('u1', '1970-01-01', 1);
      expect(top).toHaveLength(1);
    });
  });

  describe('getRecentPlays', () => {
    it('returns the latest plays first', () => {
      stats.logTrackPlay('u1', track('a'));
      stats.logTrackPlay('u1', track('b'));
      const recent = stats.getRecentPlays('u1', 5) as Array<{ track_identifier: string }>;
      expect(recent[0].track_identifier).toBe('b');
      expect(recent[1].track_identifier).toBe('a');
    });
  });

  describe('getPeriodStats', () => {
    it('returns tracks_played, unique_artists, unique_tracks, total_duration_ms', () => {
      stats.logTrackPlay('u1', track('a', { author: 'A', duration: 1000 }));
      stats.logTrackPlay('u1', track('b', { author: 'B', duration: 2000 }));
      stats.logTrackPlay('u1', track('a', { author: 'A', duration: 1000 })); // dup identifier
      const period = stats.getPeriodStats('u1', '1970-01-01') as {
        tracks_played: number;
        unique_artists: number;
        unique_tracks: number;
        total_duration_ms: number;
      };
      expect(period.tracks_played).toBe(3);
      expect(period.unique_artists).toBe(2);
      expect(period.unique_tracks).toBe(2);
      expect(period.total_duration_ms).toBe(4000);
    });
  });

  describe('getSinceDate (static)', () => {
    it('returns the default for "all"', () => {
      expect(StatsRepo.getSinceDate('all')).toBe('1970-01-01');
    });

    it('returns today for "today"', () => {
      expect(StatsRepo.getSinceDate('today')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns an ISO string for week/month/year', () => {
      expect(StatsRepo.getSinceDate('week')).toMatch(/T/);
      expect(StatsRepo.getSinceDate('month')).toMatch(/T/);
      expect(StatsRepo.getSinceDate('year')).toMatch(/T/);
    });
  });

  describe('formatTime (static)', () => {
    it('returns "0m" for 0 or negative', () => {
      expect(StatsRepo.formatTime(0)).toBe('0m');
      expect(StatsRepo.formatTime(-1)).toBe('0m');
    });

    it('formats minutes only when under an hour', () => {
      expect(StatsRepo.formatTime(30 * 60_000)).toBe('30m');
    });

    it('formats hours and minutes when >= 1h', () => {
      expect(StatsRepo.formatTime(2 * 60 * 60_000 + 15 * 60_000)).toBe('2h 15m');
    });
  });

  describe('getFullReport', () => {
    it('returns aggregate, period, top artists, top tracks, top sources, recent plays, periodLabel', () => {
      stats.logTrackPlay('u1', track('a'));
      const report = stats.getFullReport('u1', 'all') as {
        aggregate: object;
        period: object;
        topArtists: unknown[];
        topTracks: unknown[];
        topSources: unknown[];
        recentPlays: unknown[];
        periodLabel: string;
      };
      expect(report.periodLabel).toBe('all');
      expect(report.aggregate).toBeDefined();
      expect(report.period).toBeDefined();
      expect(Array.isArray(report.topArtists)).toBe(true);
      expect(Array.isArray(report.topTracks)).toBe(true);
      expect(Array.isArray(report.topSources)).toBe(true);
      expect(Array.isArray(report.recentPlays)).toBe(true);
    });
  });

  describe('getGlobalTopListeners', () => {
    it('orders users by total plays', () => {
      stats.logTrackPlay('u1', track('a'));
      stats.logTrackPlay('u2', track('a'));
      stats.logTrackPlay('u2', track('b'));
      stats.logTrackPlay('u2', track('c'));
      const top = stats.getGlobalTopListeners(5) as Array<{ user_id: string; total_tracks_played: number }>;
      expect(top[0].user_id).toBe('u2');
      expect(top[0].total_tracks_played).toBe(3);
      expect(top[1].user_id).toBe('u1');
    });
  });
});
