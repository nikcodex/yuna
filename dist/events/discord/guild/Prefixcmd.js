import { AttachmentBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { Middleware } from "#core/Middleware";
import { logger } from "#utils/logger";
import { localeStore } from "#utils/localeStore.js";
import { DiscordLogger } from "#utils/DiscordLogger";
import { db } from "#database/Database";
import { i18n } from "#utils/i18n.js";
import { PlayerManager } from "#audio/PlayerManager";
import { config } from "#config/config";
import emoji from "#config/emoji";
import { BannerCard } from "#ui/cards/BannerCard";
import { buildYunaContainer } from "#ui/Theme";
function _parseCommand(message, client) {
    const content = message.content.trim();
    const mentionPrefixRegex = new RegExp(`^<@!?${client.user.id}>\\s+`);
    const mentionMatch = content.match(mentionPrefixRegex);
    let commandText = null;
    if (mentionMatch) {
        commandText = content.slice(mentionMatch[0].length).trim();
    }
    else {
        if (db.isUserPremium(message.author.id)) {
            const userPrefix = db
                .getUserPrefixes(message.author.id)
                // @ts-ignore
                .find((p) => content.startsWith(p));
            if (userPrefix) {
                commandText = content.slice(userPrefix.length).trim();
            }
        }
        if (commandText === null) {
            const guildPrefix = db
                .getPrefixes(message.guild.id)
                .find((p) => content.startsWith(p));
            if (guildPrefix) {
                commandText = content.slice(guildPrefix.length).trim();
            }
        }
        if (commandText === null && db.hasNoPrefix(message.author.id)) {
            commandText = content;
        }
        if (commandText === null) {
            if (/^(yuna|yuki)/i.test(content)) {
                const match = content.match(/^(yuna|yuki)/i);
                commandText = content.slice(match[0].length).trim();
            }
        }
    }
    if (commandText === null)
        return null;
    const parts = commandText.split(/\s+/);
    const commandName = parts.shift()?.toLowerCase();
    return commandName ? { commandName, args: parts } : null;
}
export default {
    name: "messageCreate",
    async execute(message, client) {
        if (message.author.bot || !message.guild)
            return;
        if (db.isUserBlacklisted(message.author.id) || db.isGuildBlacklisted(message.guild.id))
            return;
        const mentionRegex = new RegExp(`^<@!?${client.user.id}>\\s*$`);
        if (mentionRegex.test(message.content.trim())) {
            const guildPrefixes = db.getPrefixes(message.guild.id);
            const userPrefixes = db.getUserPrefixes(message.author.id);
            const supportButton = new ButtonBuilder()
                .setLabel("Support Server")
                .setURL(config.links?.supportServer || "https://discord.gg/XYwwyDKhec")
                .setStyle(ButtonStyle.Link);
            const inviteButton = new ButtonBuilder()
                .setLabel("Invite Me")
                .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
                .setStyle(ButtonStyle.Link);
            const row = new ActionRowBuilder().addComponents(supportButton, inviteButton);
            const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const guildCount = client.guilds.cache.size;
            let lavalinkStatus = "Disconnected";
            let lavalinkColor = emoji.get("cross") || "❌";
            if (client.music && client.music.lavalink) {
                // @ts-ignore
                const connectedNodes = Array.from(client.music.lavalink.nodeManager.nodes.values()).filter(n => n.connected);
                if (connectedNodes.length > 0) {
                    lavalinkStatus = "Connected";
                    lavalinkColor = emoji.get("check") || "✅";
                }
            }
            let content = `**Advanced Music & Utility Bot**\n\n`;
            content += `┌─ **${emoji.get("info")} Configuration**\n`;
            content += `├─ My Prefix: \`${guildPrefixes[0]}\` (or \`yuna\`)\n`;
            if (userPrefixes.length > 0) {
                // @ts-ignore
                content += `├─ Your Prefixes: ${userPrefixes.map(p => `\`${p}\``).join(', ')}\n`;
            }
            content += `├─ Slash Commands: Fully Supported (\`/help\`, \`/play\`)\n`;
            content += `└─ Help Command: \`${guildPrefixes[0]}help\` or \`/help\`\n\n`;
            content += `┌─ **${emoji.get("music")} System Statistics**\n`;
            content += `├─ Servers: ${guildCount.toLocaleString()}\n`;
            content += `├─ Memory: ${memoryUsage} MB\n`;
            content += `└─ Lavalink: ${lavalinkStatus} ${lavalinkColor}`;
            try {
                const bannerBuffer = BannerCard ? await BannerCard.renderBanner() : null;
                const attachment = bannerBuffer ? new AttachmentBuilder(bannerBuffer, { name: 'yuna-banner.png' }) : null;
                const containerOpts = {
                    title: `${client.user.username} Information`,
                    content: content,
                    thumbnail: client.user.displayAvatarURL({ size: 256 }),
                    components: [row],
                    icon: '🌸'
                };
                if (attachment) {
                    // @ts-ignore
                    containerOpts.image = 'attachment://yuna-banner.png';
                }
                const container = buildYunaContainer(containerOpts);
                const replyOpts = {
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                };
                if (attachment) {
                    // @ts-ignore
                    replyOpts.files = [attachment];
                }
                return message.reply(replyOpts);
            }
            catch (err) {
                logger.error('MentionResponse', 'Error rendering banner:', err);
                const fallbackContainer = buildYunaContainer({
                    title: `${client.user.username} Information`,
                    content: content,
                    thumbnail: client.user.displayAvatarURL({ size: 256 }),
                    components: [row],
                    icon: '🌸'
                });
                return message.reply({
                    components: [fallbackContainer],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        }
        const commandInfo = _parseCommand(message, client);
        if (!commandInfo)
            return;
        const { commandName, args } = commandInfo;
        let command = client.commands.get(commandName);
        if (!command) {
            const aliasTarget = client.aliases.get(commandName);
            if (aliasTarget) {
                command = client.commands.get(aliasTarget);
            }
        }
        if (!command)
            return;
        const player = client.music?.getPlayer(message.guild.id);
        const ctx = {
            interaction: null,
            client,
            message,
            args,
            guild: message.guild,
            user: message.author,
            member: message.member,
            channel: message.channel,
            player,
            pm: player ? new PlayerManager(player) : null,
            // @ts-ignore
            locale: db?.users?.getLocale(message?.author?.id) || db?.guilds?.getLocale(message?.guild?.id) || 'en-US',
            // @ts-ignore
            t: (category, replacements = {}) => i18n.t(db?.users?.getLocale(message?.author?.id) || db?.guilds?.getLocale(message?.guild?.id) || 'en-US', category, replacements)
        };
        try {
            const middlewareResult = await Middleware.run(ctx, command);
            if (!middlewareResult.pass) {
                return message.reply(middlewareResult.response);
            }
            if (db.economy) {
                db.economy.addCoins(message.author.id, 1);
            }
            const proceed = await command.beforeExecute(ctx);
            if (!proceed)
                return;
            await localeStore.run({ locale: ctx.locale || db?.guilds?.getLocale(ctx.guild?.id) || 'en-US' }, async () => {
                await command.execute(ctx);
            });
            await command.afterExecute(ctx);
            DiscordLogger.logCmdRun(client, { user: message.author, commandName: command.name, guild: message.guild, type: 'Prefix', args });
        }
        catch (error) {
            DiscordLogger.logError(client, { context: `PrefixCmd:${command.name}`, error, message: `Error running ${command.name}` });
            if (typeof command.onError === 'function') {
                await command.onError(ctx, error);
            }
            else {
                logger.error("MessageCreate", `Error executing command '${command.name}'`, error);
                await message.reply("An unexpected error occurred while running the command.").catch(() => { });
            }
        }
    },
};
