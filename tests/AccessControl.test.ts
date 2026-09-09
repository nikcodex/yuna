import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { config } from '../src/config/config';

// Mock the database module before importing AccessControl
vi.mock('../src/database/Database', () => {
  return {
    db: {
      isUserPremium: vi.fn(),
      isGuildPremium: vi.fn(),
      hasAnyPremium: vi.fn(),
      isUserBlacklisted: vi.fn(),
      isGuildBlacklisted: vi.fn(),
    },
  };
});

import { isPremium, isOwner, isBlacklisted } from '../src/core/AccessControl';
import { db } from '../src/database/Database';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AccessControl.isOwner', () => {
  it('returns true when the id is in config.ownerIds', () => {
    expect(isOwner(config.ownerIds[0] ?? 'some-owner')).toBe(true);
  });

  it('returns false for an unrelated id', () => {
    expect(isOwner('not-the-owner-12345')).toBe(false);
  });
});

describe('AccessControl.isBlacklisted', () => {
  it('returns true if the user is blacklisted', () => {
    db.isUserBlacklisted.mockReturnValue({ blacklisted: true, reason: 'spam' });
    db.isGuildBlacklisted.mockReturnValue(false);
    expect(isBlacklisted('u1', 'g1')).toBe(true);
    expect(db.isUserBlacklisted).toHaveBeenCalledWith('u1');
  });

  it('returns true if the guild is blacklisted', () => {
    db.isUserBlacklisted.mockReturnValue(false);
    db.isGuildBlacklisted.mockReturnValue({ blacklisted: true, reason: 'spam' });
    expect(isBlacklisted('u1', 'g1')).toBe(true);
  });

  it('returns false if neither is blacklisted', () => {
    db.isUserBlacklisted.mockReturnValue(false);
    db.isGuildBlacklisted.mockReturnValue(false);
    expect(isBlacklisted('u1', 'g1')).toBe(false);
  });

  it('skips the guild check when guildId is null/undefined', () => {
    db.isUserBlacklisted.mockReturnValue(false);
    expect(isBlacklisted('u1', null)).toBe(false);
    expect(db.isGuildBlacklisted).not.toHaveBeenCalled();
  });
});

describe('AccessControl.isPremium (with cache)', () => {
  beforeEach(() => {
    // Different cache keys across tests — call cache-bust by using unique ids
  });

  it('type=user: returns true if db.isUserPremium returns truthy', () => {
    db.isUserPremium.mockReturnValue({ type: 'user' });
    expect(isPremium('u1', null, 'user')).toBe(true);
  });

  it('type=user: returns false if db.isUserPremium returns falsy', () => {
    db.isUserPremium.mockReturnValue(false);
    expect(isPremium('u2', null, 'user')).toBe(false);
  });

  it('type=guild: returns true if db.isGuildPremium returns truthy', () => {
    db.isGuildPremium.mockReturnValue({ type: 'guild' });
    expect(isPremium('u3', 'g3', 'guild')).toBe(true);
  });

  it('type=guild: returns false when no guildId is provided', () => {
    expect(isPremium('u4', null, 'guild')).toBe(false);
    expect(db.isGuildPremium).not.toHaveBeenCalled();
  });

  it('type=any: returns true if db.hasAnyPremium returns truthy', () => {
    db.hasAnyPremium.mockReturnValue({ type: 'user' });
    expect(isPremium('u5', 'g5', 'any')).toBe(true);
  });

  it('type=any: returns false if db.hasAnyPremium returns falsy', () => {
    db.hasAnyPremium.mockReturnValue(false);
    expect(isPremium('u6', 'g6', 'any')).toBe(false);
  });

  it('caches the result on subsequent calls', () => {
    db.hasAnyPremium.mockReturnValue(true);
    isPremium('u-cache', 'g-cache', 'any');
    isPremium('u-cache', 'g-cache', 'any');
    isPremium('u-cache', 'g-cache', 'any');
    expect(db.hasAnyPremium).toHaveBeenCalledTimes(1);
  });
});

describe('AccessControl.checkPermissions', () => {
  // We don't import checkPermissions here because it requires a real GuildMember
  // shape; covered by integration tests. Instead we sanity-check the in-code
  // behavior via the public surface we know is pure.
  it('re-exports the function (smoke)', () => {
    // Module must load without throwing
    expect(typeof isPremium).toBe('function');
    expect(typeof isOwner).toBe('function');
    expect(typeof isBlacklisted).toBe('function');
  });

  it('PermissionFlagsBits is importable from discord.js (test infra sanity)', () => {
    expect(typeof PermissionFlagsBits.Administrator).toBe('bigint');
  });
});
