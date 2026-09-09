import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize } from "discord.js";
import { config } from '#config/config';
import { Command } from '#core/Command';
import { buildContainer, buildError } from '#ui/Theme';
import { logger } from '#utils/logger';
import emoji from '#config/emoji';
import phrases from '#utils/phrases';
import { PlayerManager } from '#audio/PlayerManager';
class LoopCommand extends Command {
    constructor() {
        super({
            name: "loop",
            description: "Toggle the loop mode between off, track, and queue with interactive controls",
            usage: "loop [off|track|queue]",
            aliases: ["repeat"],
            category: "music",
            examples: [
                "loop",
                "loop off",
                "loop track",
                "loop queue",
                "repeat"
            ],
            cooldown: 3,
            access: {
                voice: true,
                sameVoice: true,
                player: true,
            },
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: "loop",
                    description: "Toggle the loop mode between off, track, and queue",
                    options: [
                        {
                            name: "mode",
                            description: "Loop mode to set",
                            type: 3,
                            required: false,
                            choices: [
                                { name: "Off", value: "off" },
                                { name: "Track", value: "track" },
                                { name: "Queue", value: "queue" }
                            ]
                        }
                    ]
                },
            },
        });
    }
    async execute(ctx) {
        const { client, message, interaction, player, pm, args = [] } = ctx;
        const context = interaction || message;
        const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
        if (!activePm)
            return;
        const mode = interaction ? interaction.options.getString("mode") : args?.[0]?.toLowerCase();
        if (mode && ["off", "track", "queue"].includes(mode)) {
            return this._handleDirectLoop(context, activePm, mode);
        }
        return this._handleLoop(context, activePm, client);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleDirectLoop(context, pm, mode) {
        await pm.setRepeatMode(mode);
        let modeText = "";
        switch (mode) {
            case "off":
                modeText = "Loop is OFF";
                break;
            case "track":
                modeText = "Looping Current Track";
                break;
            case "queue":
                modeText = "Looping Queue";
                break;
        }
        const container = this._createDirectModeContainer(pm, mode, modeText);
        const sent = await this._reply(context, container);
        if (sent) {
            this._setupCollector(sent, context.author || context.user, pm);
        }
    }
    // @ts-ignore
    async _handleLoop(context, pm, client) {
        const container = this._buildLoopContainer(pm);
        const message = await this._reply(context, container);
        if (message) {
            this._setupCollector(message, context.author || context.user, pm);
        }
    }
    // @ts-ignore
    _createDirectModeContainer(pm, mode, modeText) {
        const container = buildContainer({ image: undefined,
            title: modeText,
            content: `${emoji.get('info')} **${phrases.get('loopMode')}**`,
            thumbnail: config.assets.defaultThumbnail || config.assets.defaultTrackArtwork,
            icon: emoji.get("check") || "ℹ️"
        });
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId('loop_back')
            .setLabel('Back to Controls')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get('reset') || "↩️"));
        container.addActionRowComponents(buttons);
        return container;
    }
    // @ts-ignore
    _buildLoopContainer(pm) {
        const currentMode = pm.repeatMode || (pm.player?.loop || 'off');
        const artworkUrl = pm.currentTrack?.info?.artworkUrl || config.assets.defaultTrackArtwork;
        let modeText = "Off";
        if (currentMode === "track")
            modeText = "Current Track (🔂)";
        else if (currentMode === "queue")
            modeText = "Entire Queue (🔁)";
        const content = `**Loop Configuration**\n\n` +
            `└─ **${emoji.get("info") || "ℹ️"} Current Mode:** ${modeText}\n` +
            `└─ **${emoji.get("music") || "🎵"} Track:** ${pm.currentTrack?.info?.title || "None"}\n` +
            `└─ **${emoji.get("folder") || "📁"} Queue Size:** ${pm.queueSize} tracks\n\n` +
            `*Click the buttons below to switch loop mode*`;
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId("loop_off")
            .setLabel("Off")
            .setStyle(currentMode === "off" ? ButtonStyle.Success : ButtonStyle.Secondary), new ButtonBuilder()
            .setCustomId("loop_track")
            .setLabel("Track")
            .setStyle(currentMode === "track" ? ButtonStyle.Success : ButtonStyle.Secondary), new ButtonBuilder()
            .setCustomId("loop_queue")
            .setLabel("Queue")
            .setStyle(currentMode === "queue" ? ButtonStyle.Success : ButtonStyle.Secondary), new ButtonBuilder()
            .setCustomId("loop_help")
            .setLabel("Help")
            .setStyle(ButtonStyle.Secondary));
        return buildContainer({ image: undefined,
            title: "Loop Settings",
            content,
            thumbnail: artworkUrl,
            components: [buttons],
            icon: emoji.get("loop") || "🔁"
        });
    }
    _createHelpContainer() {
        const content = `**Loop Modes Explained**\n\n` +
            `└─ **Off:** Playback proceeds normally without repeating.\n` +
            `└─ **Track:** Repeats the currently playing song indefinitely.\n` +
            `└─ **Queue:** Loops through the entire queue of tracks endlessly.\n\n` +
            `*Select a mode from the buttons or use \`/loop <mode>\`*`;
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId("loop_back")
            .setLabel("Back to Controls")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get("reset") || "↩️"));
        return buildContainer({ image: undefined,
            title: "Loop Help",
            content,
            components: [buttons],
            icon: emoji.get("info") || "ℹ️"
        });
    }
    // @ts-ignore
    async _setupCollector(message, author, pm) {
        const filter = (i) => i.user.id === author.id;
        const collector = message.createMessageComponentCollector({ filter, time: 300_000 });
        collector.on("collect", async (interaction) => {
            try {
                await interaction.deferUpdate();
                const currentPlayer = interaction.client.music?.getPlayer(interaction.guild.id);
                if (!currentPlayer) {
                    collector.stop();
                    return;
                }
                const currentPm = new PlayerManager(currentPlayer);
                if (interaction.customId.startsWith('loop_') && interaction.customId !== 'loop_help' && interaction.customId !== 'loop_back') {
                    const action = interaction.customId.split('_')[1];
                    await currentPm.setRepeatMode(action);
                    const newContainer = this._buildLoopContainer(currentPm);
                    await interaction.editReply({ components: [newContainer] });
                }
                else if (interaction.customId === 'loop_help') {
                    await interaction.editReply({
                        components: [this._createHelpContainer()],
                    });
                }
                else if (interaction.customId === 'loop_back') {
                    const container = this._buildLoopContainer(currentPm);
                    await interaction.editReply({ components: [container] });
                }
            }
            catch (error) {
                logger.error("LoopCommand", "Collector Error:", error);
            }
        });
        collector.on("end", async (collected, reason) => {
            if (reason === "limit" || reason === "messageDelete")
                return;
            try {
                const currentMessage = await this._fetchMessage(message).catch(() => null);
                if (!currentMessage?.components?.length) {
                    return;
                }
                const containerWithoutButtons = new ContainerBuilder();
                // @ts-ignore
                currentMessage.components.forEach(component => {
                    if (component.type !== ComponentType.ActionRow) {
                        if (component.type === ComponentType.TextDisplay) {
                            containerWithoutButtons.addTextDisplayComponents(component);
                        }
                        else if (component.type === ComponentType.Separator) {
                            containerWithoutButtons.addSeparatorComponents(component);
                        }
                        else if (component.type === ComponentType.Section) {
                            containerWithoutButtons.addSectionComponents(component);
                        }
                    }
                });
                await currentMessage.edit({
                    components: [containerWithoutButtons],
                    flags: MessageFlags.IsComponentsV2,
                }).catch(() => { });
            }
            catch (error) {
                this._handleDisableError(error, reason);
            }
        });
    }
    // @ts-ignore
    async _fetchMessage(messageOrInteraction) {
        if (messageOrInteraction.fetchReply) {
            return await messageOrInteraction.fetchReply();
        }
        else if (messageOrInteraction.fetch) {
            return await messageOrInteraction.fetch();
        }
        else {
            return messageOrInteraction;
        }
    }
    // @ts-ignore
    _handleDisableError(error, reason) {
        if (error.code === 10008) {
            logger.debug("LoopCommand", `Message was deleted, cannot disable components. Reason: ${reason}`);
        }
        else if (error.code === 50001) {
            logger.warn("LoopCommand", `Missing permissions to edit message. Reason: ${reason}`);
        }
        else {
            logger.error("LoopCommand", `Error disabling components: ${error.message}. Reason: ${reason}`, error);
        }
    }
    _createErrorContainer(message) {
        return buildError(message);
    }
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true
        };
        try {
            if (context.editReply && (context.deferred || context.replied)) {
                return await context.editReply(payload);
            }
            return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
        }
        catch (e) {
            logger.error("LoopCommand", "Failed to reply in Loop command:", e);
            return null;
        }
    }
}
export default new LoopCommand();
