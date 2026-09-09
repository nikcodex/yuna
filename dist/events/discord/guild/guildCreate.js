import { DiscordLogger } from '#utils/DiscordLogger';
import { logger } from '#utils/logger';
export default {
    name: 'guildCreate',
    once: false,
    async execute(guild, client) {
        try {
            logger.info('GuildJoin', `Joined new guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
            await DiscordLogger.logGuildJoin(client, guild);
        }
        catch (error) {
            logger.error('GuildJoin', 'Error in guildCreate event:', error);
        }
    }
};
