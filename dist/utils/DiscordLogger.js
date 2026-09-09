import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, MessageFlags } from 'discord.js';
import { config } from '#config/config';
import { logger } from '#utils/logger';
import emoji from '#config/emoji';
export class DiscordLogger {
    static getChannel(client, channelId) {
        if (!client || !channelId)
            return null;
        return client.channels?.cache?.get(channelId) || null;
    }
    static async sendLog(client, channelId, container) {
        try {
            const channel = this.getChannel(client, channelId);
            if (!channel)
                return;
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
        catch (err) {
            // @ts-ignore
            logger.debug('DiscordLogger', `Failed to send log to channel ${channelId}: ${err.message}`);
        }
    }
    // 1. Guild Join Log (1535515373049356308)
    static async logGuildJoin(client, guild) {
        const channelId = config.logChannels?.guildJoin;
        if (!channelId)
            return;
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emoji.get('check') || '✅'} **New Guild Joined**`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${emoji.get('folder')} Server Info**\n` +
            `├─ **Name:** ${guild.name}\n` +
            `├─ **ID:** \`${guild.id}\` \n` +
            `├─ **Members:** ${guild.memberCount.toLocaleString()}\n` +
            `└─ **Owner:** <@${guild.ownerId}> (\`${guild.ownerId}\`)\n\n` +
            `**Total Servers Now:** ${client.guilds?.cache?.size || 'N/A'}`)));
        await this.sendLog(client, channelId, container);
    }
    // 2. Guild Leave Log (1535515407694307348)
    static async logGuildLeave(client, guild) {
        const channelId = config.logChannels?.guildLeave;
        if (!channelId)
            return;
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emoji.get('cross') || '❌'} **Guild Removed**`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${emoji.get('folder')} Server Info**\n` +
            `├─ **Name:** ${guild.name}\n` +
            `├─ **ID:** \`${guild.id}\` \n` +
            `└─ **Members:** ${guild.memberCount?.toLocaleString() || 'N/A'}\n\n` +
            `**Total Servers Now:** ${client.guilds?.cache?.size || 'N/A'}`)));
        await this.sendLog(client, channelId, container);
    }
    // 3. Command Execution Log (1535515435880161280)
    // @ts-ignore
    static async logCmdRun(client, { user, commandName, guild, type = 'Prefix', args = [] }) {
        const channelId = config.logChannels?.cmdRun;
        if (!channelId)
            return;
        const argsText = args.length > 0 ? `\`${args.join(' ')}\`` : '*None*';
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚡ **Command Executed**`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${emoji.get('folder')} Command Details**\n` +
            `├─ **Command:** \`${commandName}\` (${type})\n` +
            `├─ **User:** ${user.username} (\`${user.id}\`)\n` +
            `├─ **Guild:** ${guild ? `${guild.name} (\`${guild.id}\`)` : 'Direct Message'}\n` +
            `└─ **Arguments:** ${argsText}`)));
        await this.sendLog(client, channelId, container);
    }
    // 4. Error Log (1535515512514289717)
    // @ts-ignore
    static async logError(client, { context, error, message }) {
        const channelId = config.logChannels?.errorLogs;
        if (!channelId)
            return;
        const errorDetails = error ? `\`\`\`js\n${(error.stack || error.toString()).slice(0, 800)}\n\`\`\`` : '*No Stack Trace*';
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emoji.get('cross') || '⚠️'} **System Error Caught**`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${emoji.get('folder')} Context:** \`${context}\` \n` +
            `**Message:** ${message || 'Error occurred'}\n\n` +
            `**Trace:**\n${errorDetails}`)));
        await this.sendLog(client, channelId, container);
    }
    // 5. Music Log (1535516152581595207)
    // @ts-ignore
    static async logMusic(client, { event, guild, track, requester }) {
        const channelId = config.logChannels?.musicLogs;
        if (!channelId)
            return;
        const trackTitle = track?.title || track?.info?.title || 'Unknown Track';
        const author = track?.author || track?.info?.author || 'Unknown Artist';
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎵 **Music Event: ${event}**`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${emoji.get('folder')} Track Details**\n` +
            `├─ **Title:** ${trackTitle}\n` +
            `├─ **Artist:** ${author}\n` +
            `├─ **Guild:** ${guild ? `${guild.name} (\`${guild.id}\`)` : 'N/A'}\n` +
            `└─ **Requested By:** ${requester ? `${requester.displayName || requester.username} (\`${requester.id}\`)` : 'Autoplay'}`)));
        await this.sendLog(client, channelId, container);
    }
    // 6. Abuse & Blacklist Log (1535516194067718164)
    // @ts-ignore
    static async logAbuseBlacklist(client, { action, targetId, targetType = 'User', reason, admin }) {
        const channelId = config.logChannels?.abuseBlacklist;
        if (!channelId)
            return;
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🛡️ **Anti-Abuse / Blacklist Action**`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${emoji.get('folder')} Audit Log**\n` +
            `├─ **Action:** ${action}\n` +
            `├─ **Target:** ${targetType} (\`${targetId}\`)\n` +
            `├─ **Reason:** ${reason || 'Excessive Cooldown Violations'}\n` +
            `└─ **Executed By:** ${admin ? `${admin.username} (\`${admin.id}\`)` : 'System Automated Guard'}`)));
        await this.sendLog(client, channelId, container);
    }
    // 7. Cluster & Lavalink Log (1535516683047936070)
    // @ts-ignore
    static async logClusterLavalink(client, { title, message, status = 'INFO' }) {
        const channelId = config.logChannels?.clusterLavalink;
        if (!channelId)
            return;
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🌐 **Cluster / Lavalink: ${title}**`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Status:** \`${status}\` \n` +
            `**Details:** ${message}`)));
        await this.sendLog(client, channelId, container);
    }
}
