import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from '../src/core/Command';
import type { CommandContext } from '../src/core/Command';

const baseCtx: CommandContext = {
  client: {},
  user: { id: 'u1' } as any,
  guild: null,
  channel: null,
  t: (_cat, replacements) => JSON.stringify(replacements),
  locale: 'en-US',
};

describe('Command', () => {
  describe('constructor defaults', () => {
    it('defaults name to undefined when constructed empty', () => {
      const c = new Command();
      expect(c.name).toBeUndefined();
    });

    it('uses the supplied name', () => {
      const c = new Command({ name: 'play' });
      expect(c.name).toBe('play');
    });

    it('falls back to "No description provided" when description is missing', () => {
      const c = new Command({ name: 'play' });
      expect(c.description).toBe('No description provided');
    });

    it('defaults usage to the command name', () => {
      const c = new Command({ name: 'play' });
      expect(c.usage).toBe('play');
    });

    it('defaults cooldown to 3 seconds', () => {
      const c = new Command({ name: 'play' });
      expect(c.cooldown).toBe(3);
    });

    it('defaults category to "Miscellaneous"', () => {
      const c = new Command({ name: 'play' });
      expect(c.category).toBe('Miscellaneous');
    });

    it('defaults maintenance to false', () => {
      const c = new Command({ name: 'play' });
      expect(c.maintenance).toBe(false);
    });

    it('defaults aliases to an empty list', () => {
      const c = new Command({ name: 'play' });
      expect(c.aliases).toEqual([]);
    });
  });

  describe('access object resolution', () => {
    it('reads from the new `access` object first', () => {
      const c = new Command({
        name: 'x',
        access: {
          ownerOnly: true,
          voice: true,
          premium: 'user',
          permissions: ['Administrator' as any],
        },
      });
      expect(c.access.ownerOnly).toBe(true);
      expect(c.access.voice).toBe(true);
      expect(c.access.premium).toBe('user');
      expect(c.access.permissions).toEqual(['Administrator']);
    });

    it('falls back to legacy top-level flags (userPrem, voiceRequired)', () => {
      const c = new Command({
        name: 'x',
        userPrem: true,
        voiceRequired: true,
        sameVoiceRequired: true,
        playerRequired: true,
        playingRequired: true,
        ownerOnly: true,
      });
      expect(c.access.premium).toBe('user');
      expect(c.access.voice).toBe(true);
      expect(c.access.sameVoice).toBe(true);
      expect(c.access.player).toBe(true);
      expect(c.access.playing).toBe(true);
      expect(c.access.ownerOnly).toBe(true);
    });

    it('premium: false when no premium-related options are set', () => {
      const c = new Command({ name: 'x' });
      expect(c.access.premium).toBe(false);
    });

    it('maps guildPrem to premium: "guild"', () => {
      const c = new Command({ name: 'x', guildPrem: true });
      expect(c.access.premium).toBe('guild');
    });

    it('maps anyPrem to premium: "any"', () => {
      const c = new Command({ name: 'x', anyPrem: true });
      expect(c.access.premium).toBe('any');
    });
  });

  describe('slash configuration', () => {
    it('defaults enabled to false and autoDefer to true', () => {
      const c = new Command({ name: 'x' });
      expect(c.slash.enabled).toBe(false);
      expect(c.slash.autoDefer).toBe(true);
    });

    it('reads from the new `slash` object', () => {
      const c = new Command({
        name: 'x',
        slash: { enabled: true, autoDefer: false, data: { name: 'x', description: 'd' } },
      });
      expect(c.slash.enabled).toBe(true);
      expect(c.slash.autoDefer).toBe(false);
      expect(c.slash.data).toEqual({ name: 'x', description: 'd' });
    });

    it('falls back to legacy enabledSlash and slashData', () => {
      const c = new Command({ name: 'x', enabledSlash: true, slashData: { name: 'x' } });
      expect(c.slash.enabled).toBe(true);
      expect(c.slash.data).toEqual({ name: 'x' });
    });
  });

  describe('execute lifecycle', () => {
    it('throws by default if execute() is not overridden', async () => {
      const c = new Command({ name: 'broken' });
      await expect(c.execute(baseCtx)).rejects.toThrow(/doesn't provide an execute method/);
    });

    it('beforeExecute returns true by default', async () => {
      const c = new Command({ name: 'x' });
      await expect(c.beforeExecute(baseCtx)).resolves.toBe(true);
    });

    it('afterExecute and onError are no-ops by default', async () => {
      const c = new Command({ name: 'x' });
      await expect(c.afterExecute(baseCtx)).resolves.toBeUndefined();
      // onError logs; just call it to confirm it doesn't throw
      await c.onError(baseCtx, new Error('test'));
    });

    it('subclasses can override execute, beforeExecute, and afterExecute', async () => {
      class MyCmd extends Command {
        async beforeExecute(ctx: CommandContext) { return ctx.user?.id === 'allowed'; }
        async execute(ctx: CommandContext) { return 'ran'; }
        async afterExecute(ctx: CommandContext) { /* nothing */ }
      }
      const c = new MyCmd({ name: 'x' });
      expect(await c.beforeExecute({ ...baseCtx, user: { id: 'denied' } as any })).toBe(false);
      expect(await c.beforeExecute({ ...baseCtx, user: { id: 'allowed' } as any })).toBe(true);
      expect(await c.execute(baseCtx)).toBe('ran');
    });
  });
});
