import { MessageFlags, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from "discord.js";
import { Command } from "#core/Command";
import emoji from "#config/emoji";
import { logger } from "#utils/logger";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
class ServersCommand extends Command {
    constructor() {
        super({
            name: "servers",
            description: "Explore servers, inspect music state, generate invites, or leave remotely (Owner Only)",
            usage: "servers [leave <guildId> | invite <guildId> | search <query>]",
            aliases: ["guilds", "serverlist", "glist"],
            category: "developer",
            access: { ownerOnly: true },
            slash: {
                enabled: false
            }
        });
    }
    // @ts-ignore
    async autocomplete({ interaction, client }) {
        const focused = interaction.options.getFocused().toLowerCase();
        const guilds = Array.from(client.guilds.cache.values());
        const choices = guilds
            // @ts-ignore
            .filter(g => g.name.toLowerCase().includes(focused) || g.id.includes(focused))
            .slice(0, 25)
            .map(g => ({
            // @ts-ignore
            name: `🏰 ${g.name.slice(0, 50)} (${g.memberCount} members)`,
            // @ts-ignore
            value: g.id
        }));
        await interaction.respond(choices).catch(() => { });
    }
    // @ts-ignore
    async execute(ctx) {
        const { client, interaction, message, args } = ctx;
        const context = interaction || message;
        const action = interaction?.options?.getString("action") || args?.[0]?.toLowerCase() || "list";
        const targetGuildId = interaction?.options?.getString("server") || args?.[1];
        try {
            if (action === "leave" && targetGuildId) {
                return this._handleLeaveGuild(context, client, targetGuildId);
            }
            if (action === "invite" && targetGuildId) {
                return this._handleInviteGuild(context, client, targetGuildId);
            }
            const searchQuery = (action === "search" && targetGuildId) ? targetGuildId.toLowerCase() : null;
            return this._displayGuildList(context, client, searchQuery);
        }
        catch (error) {
            logger.error("ServersCommand", "Error in servers command", error);
            const err = buildError(ctx.t("failedToInspe"));
            // @ts-ignore
            if (interaction)
                return interaction.editReply({ components: [err], flags: MessageFlags.IsComponentsV2 });
            // @ts-ignore
            return message?.reply({ components: [err], flags: MessageFlags.IsComponentsV2 });
        }
    }
    // @ts-ignore
    async _displayGuildList(context, client, queryFilter = null, page = 0) {
        let guilds = Array.from(client.guilds.cache.values());
        if (queryFilter) {
            guilds = guilds.filter(
            // @ts-ignore
            (g) => g.name.toLowerCase().includes(queryFilter) || g.id.includes(queryFilter));
        }
        if (guilds.length === 0) {
            const err = buildError("No matching servers found.");
            // @ts-ignore
            if (context.editReply)
                return context.editReply({ components: [err], flags: MessageFlags.IsComponentsV2 });
            // @ts-ignore
            return context.reply({ components: [err], flags: MessageFlags.IsComponentsV2 });
        }
        const guildsPerPage = 5;
        const totalPages = Math.ceil(guilds.length / guildsPerPage);
        page = Math.max(0, Math.min(page, totalPages - 1));
        const currentGuilds = guilds.slice(page * guildsPerPage, (page + 1) * guildsPerPage);
        // @ts-ignore
        const totalMembers = guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0);
        const container = buildContainer({
            title: "Connected Servers Inspector",
            // @ts-ignore
            content: `📊 **Total Servers:** \`${client.guilds.cache.size}\` | **Total Reach:** \`${totalMembers.toLocaleString()}\` members | **Page:** \`${page + 1}/${totalPages}\``,
            icon: emoji.get("crown") || "👑"
        });
        currentGuilds.forEach((guild, idx) => {
            const globalIdx = page * guildsPerPage + idx + 1;
            // @ts-ignore
            const player = client.audio?.getPlayer(guild.id);
            const musicStatus = player?.playing ? `🎵 Playing: *${player.queue?.current?.info?.title?.slice(0, 30) || 'Active'}*` : "💤 Idle";
            container.addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            // @ts-ignore
            `\`${globalIdx}.\` **${guild.name}** \`(${guild.id})\`\n└ **Members:** \`${guild.memberCount}\` • **Music:** ${musicStatus} • **Owner:** <@${guild.ownerId}>`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(
            // @ts-ignore
            guild.iconURL({ size: 128 }) || "https://cdn.discordapp.com/embed/avatars/0.png")));
        });
        const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
        if (context.editReply && (context.deferred || context.replied)) {
            return await context.editReply(payload);
        }
        return await context.reply(payload);
    }
    // @ts-ignore
    async _handleLeaveGuild(context, client, guildId) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            const err = buildError(`Server with ID \`${guildId}\` was not found in cache.`);
            // @ts-ignore
            if (context.editReply)
                return context.editReply({ components: [err], flags: MessageFlags.IsComponentsV2 });
            // @ts-ignore
            return context.reply({ components: [err], flags: MessageFlags.IsComponentsV2 });
        }
        const name = guild.name;
        await guild.leave();
        const success = buildSuccess(`Successfully left server **${name}** \`(${guildId})\`.`, "Server Left");
        // @ts-ignore
        if (context.editReply)
            return context.editReply({ components: [success], flags: MessageFlags.IsComponentsV2 });
        // @ts-ignore
        return context.reply({ components: [success], flags: MessageFlags.IsComponentsV2 });
    }
    // @ts-ignore
    async _handleInviteGuild(context, client, guildId) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            const err = buildError(`Server with ID \`${guildId}\` was not found in cache.`);
            // @ts-ignore
            if (context.editReply)
                return context.editReply({ components: [err], flags: MessageFlags.IsComponentsV2 });
            // @ts-ignore
            return context.reply({ components: [err], flags: MessageFlags.IsComponentsV2 });
        }
        let inviteUrl = null;
        // @ts-ignore
        const channel = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('CreateInstantInvite'));
        if (channel) {
            const invite = await channel.createInvite({ maxAge: 3600, maxUses: 1 }).catch(() => null);
            if (invite)
                inviteUrl = invite.url;
        }
        if (inviteUrl) {
            const success = buildSuccess(`Invite link for **${guild.name}**: [Join Server](${inviteUrl}) (Expires in 1h)`, "Invite Generated");
            // @ts-ignore
            if (context.editReply)
                return context.editReply({ components: [success], flags: MessageFlags.IsComponentsV2 });
            // @ts-ignore
            return context.reply({ components: [success], flags: MessageFlags.IsComponentsV2 });
        }
        const err = buildError(`Could not generate invite for **${guild.name}** (missing permissions).`);
        // @ts-ignore
        if (context.editReply)
            return context.editReply({ components: [err], flags: MessageFlags.IsComponentsV2 });
        // @ts-ignore
        return context.reply({ components: [err], flags: MessageFlags.IsComponentsV2 });
    }
}
export default new ServersCommand();
