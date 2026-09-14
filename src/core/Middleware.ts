import { config } from '#config/config';
import { db } from '#database/Database';
import phrases from '#utils/phrases';
import { buildError } from '#ui/Theme';
import { checkPermissions, checkBotPermissions, isPremium, isOwner, isBlacklisted } from '../core/AccessControl';
import { AntiAbuse } from '../utils/AntiAbuse';
import { GuildMember, Guild, GuildChannel, User, Client } from 'discord.js';

export interface MiddlewareContext {
  client: any;
  user: User;
  member: GuildMember | null;
  guild: Guild | null;
  channel: GuildChannel | null;
}

export class Middleware {
  /**
   * Cross-shard cooldown + abuse tracking, persisted in SQLite via CooldownRepo.
   * Cooldowns survive restarts and are enforced uniformly across every shard,
   * instead of living only in this process's memory.
   */
  static anti = new AntiAbuse(db.cooldowns);

  /**
   * Runs the centralized execution pipeline.
   * @param ctx The execution context.
   * @param command The command being executed.
   * @returns The result of the middleware checks.
   */
  static async run(ctx: MiddlewareContext, command: any): Promise<{pass: boolean, response?: any}> {
    const { client, user, member, guild, channel } = ctx;
    const userId = user.id;
    const guildId = guild?.id;

    if (isBlacklisted(userId, guildId)) {
      return {
        pass: false,
        response: buildError({
          title: 'Access Restricted',
          issue: 'You or this server have been restricted from using Yuna.',
          tip: 'Join our Support Server to appeal this restriction.'
        })
      };
    }

    if (command.maintenance && !isOwner(userId)) {
      return {
        pass: false,
        response: buildError({
          title: 'Under Maintenance',
          issue: `The \`${command.name}\` command is currently undergoing scheduled maintenance.`,
          tip: 'Please try again in a few moments.'
        })
      };
    }

    // Auto-escalation: users who repeatedly hammered through cooldowns are
    // ignored for a short cool-off period (AntiAbuse handles expiry).
    if (this.anti.isBlacklisted(userId, command.name, guildId ?? 'dm')) {
      return {
        pass: false,
        response: buildError({
          title: 'Rate Limited',
          issue: `You repeatedly triggered the cooldown for \`${command.name}\`, so additional attempts are being ignored temporarily.`,
          tip: 'Wait a few minutes and try again.'
        })
      };
    }

    const cooldownTime = this.checkCooldown(userId, command, guildId);
    if (cooldownTime > 0) {
      const violations = this.anti.recordViolation(userId, command.name, guildId ?? 'dm');
      const escalated = violations >= 5;
      return {
        pass: false,
        response: buildError({
          title: escalated ? 'Rate Limited' : 'Slow Down',
          issue: escalated
            ? `You have triggered the \`${command.name}\` cooldown ${violations} times in the last minute.`
            : `You are sending commands too quickly!`,
          tip: escalated
            ? 'Please wait a few minutes before trying again.'
            : `Please wait **${cooldownTime}s** before using \`${command.name}\` again.`
        })
      };
    }

    if (command.access?.ownerOnly && !isOwner(userId)) {
      return {
        pass: false,
        response: buildError({
          title: 'Developer Only',
          issue: `The \`${command.name}\` command is reserved for bot developers.`,
          tip: 'Check out `/help` for public commands.'
        })
      };
    }

    if (command.access?.permissions?.length > 0) {
      if (!checkPermissions(member, command.access.permissions)) {
        return {
          pass: false,
          response: buildError({
            title: 'Insufficient Permissions',
            issue: `You lack the required Discord permissions to run this command.`,
            tip: `Required: \`${command.access.permissions.join(', ')}\``
          })
        };
      }
    }

    if (command.access?.botPermissions?.length > 0) {
      const missing = checkBotPermissions(guild, command.access.botPermissions, channel);
      if (missing.length > 0) {
        return {
          pass: false,
          response: buildError({
            title: 'Bot Permission Missing',
            issue: `I need additional Discord permissions in this channel to execute this.`,
            tip: `Missing: \`${missing.join(', ')}\``
          })
        };
      }
    }

    if (command.access?.premium) {
      if (!isPremium(userId, guildId, command.access.premium)) {
        return {
          pass: false,
          response: buildError({
            title: 'Premium Required',
            issue: `This command requires an active **${command.access.premium}** tier subscription.`,
            tip: 'Unlock high-bitrate audio & unlimited playlists with `/buypremium`.'
          })
        };
      }
    }

    if (command.access?.voice && !member?.voice?.channel) {
      return {
        pass: false,
        response: buildError({
          title: 'Voice Channel Required',
          issue: 'You must be connected to a voice channel to use music commands.',
          tip: 'Join a voice channel in this server and try again!'
        })
      };
    }

    if (command.access?.sameVoice && guild?.members?.me?.voice?.channel) {
      if (member?.voice?.channelId !== guild.members.me.voice.channelId) {
        return {
          pass: false,
          response: buildError({
            title: 'Voice Mismatch',
            issue: `You must be in the same voice channel as me to control playback.`,
            tip: `Join <#${guild.members.me.voice.channelId}> to control music.`
          })
        };
      }
    }

    if (command.access?.player || command.access?.playing) {
      const player = client.music?.getPlayer(guildId as string);

      if (command.access?.player && !player) {
        return {
          pass: false,
          response: buildError({
            title: 'No Active Player',
            issue: 'There is no music player currently active in this server.',
            tip: 'Play a song using `/play <song>` or `.play <song>`.'
          })
        };
      }

      if (command.access?.playing && (!player || !player.queue?.current)) {
        return {
          pass: false,
          response: buildError({
            title: 'Nothing Playing',
            issue: 'The music queue is currently idle or ended.',
            tip: 'Queue up a new song with `/play <song>`.'
          })
        };
      }
    }

    this.setCooldown(userId, command, guildId);

    return { pass: true };
  }

  /**
   * Checks if a user has an active cooldown for a command.
   * Backed by the shared SQLite cooldown table, so it holds across shards and restarts.
   * Returns remaining seconds (0 = free to run).
   */
  static checkCooldown(userId: string, command: any, guildId?: string | null): number {
    if (!command.cooldown) return 0;

    const keyGuild = guildId ?? 'dm';
    if (this.anti.isBlacklisted(userId, command.name, keyGuild)) return command.cooldown;

    const remainingMs = this.anti.getCooldown(userId, command.name, keyGuild);
    if (remainingMs <= 0) return 0;

    return Math.ceil(remainingMs / 1000);
  }

  static setCooldown(userId: string, command: any, guildId?: string | null): void {
    if (!command.cooldown) return;

    const keyGuild = guildId ?? 'dm';
    const hasPremium = isPremium(userId, null, 'user');
    const durationMs = command.cooldown * (hasPremium ? 0.5 : 1) * 1000;

    // Also resets any prior violation count for this key on success.
    this.anti.setCooldown(userId, command.name, keyGuild, durationMs);
  }
}

export default Middleware;

// Made by Nikhil Under CodeX Devs
