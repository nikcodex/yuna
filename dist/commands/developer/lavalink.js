import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, ThumbnailBuilder, } from "discord.js";
import { config } from "#config/config";
import { Command } from "#core/Command";
import emoji from "#config/emoji";
import { logger } from "#utils/logger";
import { buildError } from "#ui/Theme";
class LavalinkCommand extends Command {
    constructor() {
        super({
            name: "lavalink",
            description: "Inspect Lavalink nodes status, memory, CPU, and manage connections (Developer Only)",
            usage: "lavalink",
            aliases: ["nodes", "nodeinfo", "lavanode"],
            category: "developer",
            access: { ownerOnly: true },
        });
    }
    // @ts-ignore
    async execute({ client, message }) {
        try {
            const container = this._createNodeStatusContainer(client);
            const msgInstance = await message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
            this._setupCollector(msgInstance, message.author.id, client);
        }
        catch (error) {
            logger.error("LavalinkCommand", "Error in lavalink command", error);
            await message.reply({
                components: [buildError("An error occurred.")],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => { });
        }
    }
    _createNodeStatusContainer(client) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${emoji.get("music")} **Lavalink Nodes Dashboard**`));
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        const nodes = client.lavalink?.nodeManager?.nodes || new Map();
        const nodeCount = nodes.size || 0;
        if (nodeCount === 0) {
            const emptySection = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("**No Lavalink nodes connected.**\n\nCheck Lavalink server configuration in `.env`."))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork));
            container.addSectionComponents(emptySection);
        }
        else {
            let totalPlayers = 0;
            let playingPlayers = 0;
            let nodeDetails = "";
            // @ts-ignore
            nodes.forEach((node, name) => {
                const isConnected = node.connected;
                const stats = node.stats || {};
                const players = stats.players || node.players?.size || 0;
                const playing = stats.playingPlayers || 0;
                totalPlayers += players;
                playingPlayers += playing;
                const memUsedMb = stats.memory?.allocated ? (stats.memory.allocated / 1024 / 1024).toFixed(1) : "N/A";
                const memFreeMb = stats.memory?.free ? (stats.memory.free / 1024 / 1024).toFixed(1) : "N/A";
                const cpuSystem = stats.cpu?.systemLoad ? (stats.cpu.systemLoad * 100).toFixed(1) + "%" : "0%";
                const cpuLavalink = stats.cpu?.lavalinkLoad ? (stats.cpu.lavalinkLoad * 100).toFixed(1) + "%" : "0%";
                const uptimeMs = stats.uptime || 0;
                const statusDot = isConnected ? "🟢" : "🔴";
                const hostStr = `${node.options?.host || "Host"}:${node.options?.port || "9000"}`;
                nodeDetails += `${statusDot} **Node:** \`${name}\` (${hostStr})\n` +
                    `├─ **Status:** ${isConnected ? "Connected" : "Disconnected"}\n` +
                    `├─ **Players:** ${playing} playing / ${players} total\n` +
                    `├─ **CPU Load:** Lavalink ${cpuLavalink} | System ${cpuSystem}\n` +
                    `├─ **Memory:** ${memUsedMb} MB used / ${memFreeMb} MB free\n` +
                    `└─ **Node Uptime:** ${this._formatUptime(uptimeMs)}\n\n`;
            });
            const overview = `**Overall Overview**\n` +
                `├─ **Connected Nodes:** ${nodeCount}\n` +
                `├─ **Total Players:** ${totalPlayers}\n` +
                `└─ **Active Playbacks:** ${playingPlayers}\n\n` +
                `**Connected Node Details:**\n` + nodeDetails.trim();
            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(overview))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork));
            container.addSectionComponents(section);
        }
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId("node_refresh")
            .setLabel("Refresh Stats")
            .setStyle(ButtonStyle.Primary), new ButtonBuilder()
            .setCustomId("node_reconnect")
            .setLabel("Reconnect Nodes")
            .setStyle(ButtonStyle.Secondary));
        container.addActionRowComponents(buttons);
        return container;
    }
    _setupCollector(messageInstance, userId, client) {
        const collector = messageInstance.createMessageComponentCollector({
            filter: (i) => i.user.id === userId,
            time: 120_000,
        });
        collector.on("collect", async (interaction) => {
            try {
                if (interaction.customId === "node_refresh") {
                    const updatedContainer = this._createNodeStatusContainer(client);
                    await interaction.update({
                        components: [updatedContainer],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
                else if (interaction.customId === "node_reconnect") {
                    await interaction.deferUpdate();
                    const nodes = client.lavalink?.nodeManager?.nodes;
                    if (nodes) {
                        // @ts-ignore
                        nodes.forEach(async (node) => {
                            try {
                                if (!node.connected)
                                    await node.connect();
                            }
                            catch (_) { }
                        });
                    }
                    const updatedContainer = this._createNodeStatusContainer(client);
                    await interaction.editReply({
                        components: [updatedContainer],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
            }
            catch (error) {
                logger.error("LavalinkCommand", "Error in collector interaction", error);
            }
        });
    }
    _createErrorContainer(msg) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${emoji.get("cross")} **Lavalink Error**`));
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        container.addSectionComponents(new SectionBuilder()
            // @ts-ignore
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(msg))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail)));
        return container;
    }
    _formatUptime(ms) {
        if (!ms || ms <= 0)
            return "0s";
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        if (days > 0)
            return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0)
            return `${hours}h ${minutes}m ${seconds}s`;
        if (minutes > 0)
            return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    }
}
export default new LavalinkCommand();
