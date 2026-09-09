import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from './_helpers/db';
import { LikedRepo } from '../src/database/repositories/LikedRepo';

let tdb: TestDb;
let liked: LikedRepo;

beforeEach(() => {
  tdb = makeTestDb();
  liked = new LikedRepo(tdb.db);
});

afterEach(() => {
  tdb.cleanup();
});

const track = (id: string) => ({
  identifier: id,
  title: `Title ${id}`,
  author: 'Artist',
  uri: `https://example.com/${id}`,
  duration: 1000,
  sourceName: 'youtube',
  artworkUrl: null,
});

describe('LikedRepo', () => {
  it('returns an empty list for a new user', () => {
    expect(liked.getUserLiked('u1')).toEqual([]);
  });

  it('adds a track and returns true', () => {
    const result = liked.addLikedTrack('u1', track('a'));
    expect(result).toBe(true);
    const list = liked.getUserLiked('u1') as Array<{ identifier: string; title: string }>;
    expect(list).toHaveLength(1);
    expect(list[0].identifier).toBe('a');
    expect(list[0].title).toBe('Title a');
  });

  it('is idempotent on duplicate identifier (returns false)', () => {
    expect(liked.addLikedTrack('u1', track('a'))).toBe(true);
    expect(liked.addLikedTrack('u1', track('a'))).toBe(false);
    expect(liked.getUserLiked('u1')).toHaveLength(1);
  });

  it('removes a track by identifier', () => {
    liked.addLikedTrack('u1', track('a'));
    expect(liked.removeLikedTrack('u1', 'a')).toBe(true);
    expect(liked.getUserLiked('u1')).toEqual([]);
  });

  it('returns false when removing a track that does not exist', () => {
    expect(liked.removeLikedTrack('u1', 'missing')).toBe(false);
  });

  it('preserves order across adds and removes', () => {
    liked.addLikedTrack('u1', track('a'));
    liked.addLikedTrack('u1', track('b'));
    liked.addLikedTrack('u1', track('c'));
    liked.removeLikedTrack('u1', 'b');
    const list = liked.getUserLiked('u1') as Array<{ identifier: string }>;
    expect(list.map((t) => t.identifier)).toEqual(['a', 'c']);
  });
});
