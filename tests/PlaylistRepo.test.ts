import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from './_helpers/db';
import { PlaylistRepo } from '../src/database/repositories/PlaylistRepo';

let tdb: TestDb;
let pl: PlaylistRepo;

beforeEach(() => {
  tdb = makeTestDb();
  pl = new PlaylistRepo(tdb.db);
});

afterEach(() => {
  tdb.cleanup();
});

const track = (id: string, dur = 1000) => ({
  identifier: id,
  title: `Title ${id}`,
  author: 'Artist',
  uri: `https://example.com/${id}`,
  duration: dur,
  sourceName: 'youtube',
  artworkUrl: null,
});

describe('PlaylistRepo', () => {
  describe('createPlaylist / getPlaylist', () => {
    it('creates a playlist and returns it', () => {
      const created = pl.createPlaylist('u1', 'My Mix') as { id: string; user_id: string; name: string; tracks: unknown[] };
      expect(created.id).toMatch(/^pl_/);
      expect(created.user_id).toBe('u1');
      expect(created.name).toBe('My Mix');
      expect(created.tracks).toEqual([]);
    });

    it('returns null for an unknown id', () => {
      expect(pl.getPlaylist('pl_nope')).toBeNull();
    });

    it('throws on invalid name (empty or too long)', () => {
      expect(() => pl.createPlaylist('u1', '')).toThrow();
      expect(() => pl.createPlaylist('u1', 'x'.repeat(101))).toThrow();
    });

    it('throws on duplicate playlist name (case-insensitive)', () => {
      pl.createPlaylist('u1', 'My Mix');
      expect(() => pl.createPlaylist('u1', 'MY MIX')).toThrow();
    });
  });

  describe('user playlist limits', () => {
    it('rejects a 21st playlist for the same user', () => {
      for (let i = 0; i < 20; i++) pl.createPlaylist('u1', `pl-${i}`);
      expect(() => pl.createPlaylist('u1', 'pl-21')).toThrow();
    });
  });

  describe('addTrackToPlaylist / removeTrackFromPlaylist', () => {
    it('adds a track and updates duration + count', () => {
      const created = pl.createPlaylist('u1', 'X') as { id: string };
      pl.addTrackToPlaylist(created.id, 'u1', track('a', 2000));
      const updated = pl.getPlaylist(created.id) as { tracks: Array<{ identifier: string; duration: number }>; total_duration: number; track_count: number };
      expect(updated.tracks).toHaveLength(1);
      expect(updated.tracks[0].identifier).toBe('a');
      expect(updated.total_duration).toBe(2000);
      expect(updated.track_count).toBe(1);
    });

    it('throws on duplicate track in the same playlist', () => {
      const created = pl.createPlaylist('u1', 'X') as { id: string };
      pl.addTrackToPlaylist(created.id, 'u1', track('a'));
      expect(() => pl.addTrackToPlaylist(created.id, 'u1', track('a'))).toThrow();
    });

    it('rejects an unauthorized user adding tracks', () => {
      const created = pl.createPlaylist('u1', 'X') as { id: string };
      expect(() => pl.addTrackToPlaylist(created.id, 'u2', track('a'))).toThrow();
    });

    it('removes a track', () => {
      const created = pl.createPlaylist('u1', 'X') as { id: string };
      pl.addTrackToPlaylist(created.id, 'u1', track('a'));
      pl.removeTrackFromPlaylist(created.id, 'u1', 'a');
      const updated = pl.getPlaylist(created.id) as { tracks: unknown[]; track_count: number };
      expect(updated.tracks).toEqual([]);
      expect(updated.track_count).toBe(0);
    });
  });

  describe('clearPlaylist / deletePlaylist', () => {
    it('clearPlaylist empties the track list', () => {
      const created = pl.createPlaylist('u1', 'X') as { id: string };
      pl.addTrackToPlaylist(created.id, 'u1', track('a'));
      pl.addTrackToPlaylist(created.id, 'u1', track('b'));
      pl.clearPlaylist(created.id, 'u1');
      const updated = pl.getPlaylist(created.id) as { tracks: unknown[]; track_count: number };
      expect(updated.tracks).toEqual([]);
      expect(updated.track_count).toBe(0);
    });

    it('deletePlaylist removes the row', () => {
      const created = pl.createPlaylist('u1', 'X') as { id: string };
      expect(pl.deletePlaylist(created.id, 'u1')).toBe(true);
      expect(pl.getPlaylist(created.id)).toBeNull();
    });

    it('deletePlaylist denies non-owner', () => {
      const created = pl.createPlaylist('u1', 'X') as { id: string };
      expect(() => pl.deletePlaylist(created.id, 'u2')).toThrow();
    });
  });

  describe('getUserPlaylists / search / stats', () => {
    it('getUserPlaylists returns all playlists for the user only', () => {
      pl.createPlaylist('u1', 'A');
      pl.createPlaylist('u1', 'B');
      pl.createPlaylist('u2', 'C');
      const u1 = pl.getUserPlaylists('u1') as Array<{ name: string }>;
      expect(u1.map((p) => p.name).sort()).toEqual(['A', 'B']);
    });

    it('searchUserPlaylists matches name and description', () => {
      pl.createPlaylist('u1', 'Chill Vibes', 'downtempo');
      pl.createPlaylist('u1', 'Workout', 'high energy');
      const found = pl.searchUserPlaylists('u1', 'chill') as Array<{ name: string }>;
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Chill Vibes');
    });

    it('getPlaylistStats aggregates tracks and duration', () => {
      const a = pl.createPlaylist('u1', 'A') as { id: string };
      const b = pl.createPlaylist('u1', 'B') as { id: string };
      pl.addTrackToPlaylist(a.id, 'u1', track('x', 1000));
      pl.addTrackToPlaylist(a.id, 'u1', track('y', 2000));
      pl.addTrackToPlaylist(b.id, 'u1', track('z', 5000));
      const stats = pl.getPlaylistStats('u1') as { total_playlists: number; total_tracks: number; total_duration: number };
      expect(stats.total_playlists).toBe(2);
      expect(stats.total_tracks).toBe(3);
      expect(stats.total_duration).toBe(8000);
    });
  });
});
