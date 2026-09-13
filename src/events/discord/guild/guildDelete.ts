import { DiscordLogger } from '#utils/DiscordLogger';
import { logger } from '#utils/logger';

export default {
  name: 'guildDelete',
  once: false,
  async execute(guild: any, client: any) {
    try {
      logger.info('GuildLeave', `Removed from guild: ${guild.name} (${guild.id})`);
      await DiscordLogger.logGuildLeave(client, guild);
    } catch (error) {
      logger.error('GuildLeave', 'Error in guildDelete event:', error);
    }
  }
};

// Made by Nikhil Under CodeX Devs
