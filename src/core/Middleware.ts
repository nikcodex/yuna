import { config } from '#config/config';
import { db } from '#database/Database';
import phrases from '#utils/phrases';
import { buildError } from '#ui/Theme';
import { checkPermissions, checkBotPermissions, isPremium, isOwner, isBlacklisted } from '../core/AccessControl';
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
   * In-memory cooldown storage: Map<string, number>
   */
  static cooldowns = new Map<string, number>();
  static COOLDOWN_TTL_MS = 5 * 60 * 1000; // 5 minutes max age

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

    // 1. Blacklist check (guild + user)
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

    // 2. Maintenance mode
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

    // 3. Cooldown check (in-memory)
    const cooldownTime = this.checkCooldown(userId, command);
    if (cooldownTime > 0) {
      return {
        pass: false,
        response: buildError({
          title: 'Slow Down',
          issue: `You are sending commands too quickly!`,
          tip: `Please wait **${cooldownTime}s** before using \`${command.name}\` again.`
        })
      };
    }

    // 4. Owner-only check
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

    // 5. User permissions check
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

    // 6. Bot permissions check
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

    // 7. Premium check (user/guild/any)
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

    // 8. Voice channel required
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

    // 9. Same voice channel required
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

    // 10 & 11. Player and Playing required
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

    // Success - record cooldown
    this.setCooldown(userId, command);

    return { pass: true };
  }

  /**
   * Checks if a user has an active cooldown for a command.
   */
  static checkCooldown(userId: string, command: any): number {
    if (!command.cooldown) return 0;

    const key = `${userId}-${command.name}`;
    const now = Date.now();
    const baseCooldown = command.cooldown;
    const hasPremium = isPremium(userId, null, 'user');

    const cooldownSeconds = hasPremium ? baseCooldown * 0.5 : baseCooldown;
    const cooldownMs = cooldownSeconds * 1000;

    if (this.cooldowns.has(key)) {
      const expirationTime = (this.cooldowns.get(key) as number) + cooldownMs;
      if (now < expirationTime) {
        return Math.ceil((expirationTime - now) / 1000);
      }
    }
    return 0;
  }

  static setCooldown(userId: string, command: any): void {
    if (!command.cooldown) return;
    const key = `${userId}-${command.name}`;
    this.cooldowns.set(key, Date.now());
    // Evict stale entries periodically
    if (this.cooldowns.size > 10000) {
      const now = Date.now();
      for (const [k, v] of this.cooldowns.entries()) {
        if (now - v > this.COOLDOWN_TTL_MS) this.cooldowns.delete(k);
      }
    }
  }
}

export default Middleware;
