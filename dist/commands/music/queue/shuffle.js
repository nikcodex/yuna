import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize } from "discord.js";
import { config } from '#config/config';
import { Command } from '#core/Command';
import { buildContainer, buildError } from '#ui/Theme';
import { logger } from '#utils/logger';
import emoji from '#config/emoji';
import phrases from '#utils/phrases';
import { PlayerManager } from '#audio/PlayerManager';
class ShuffleCommand extends Command {
    constructor() {
        super({
            name: 'shuffle',
            description: 'Shuffle the entire queue to randomize track order',
            usage: 'shuffle',
            aliases: ['shu', 'sh', 'shuf', 'mix'],
            category: 'music',
            examples: [
                'shuffle',
                'shu',
                'mix',
                'shuf',
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
                    name: 'shuffle',
                    description: 'Shuffle the entire queue to randomize track order',
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
        return this._handleShuffle(context, activePm);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleShuffle(context, pm) {
        if (pm.queueSize < 1) {
            return this._reply(context, this._createErrorContainer(phrases.get('noTrackPlaying')));
        }
        await pm.shuffleQueue();
        const container = this._createSuccessContainer(pm);
        const message = await this._reply(context, container);
        if (message) {
            this._setupCollector(message, context.author || context.user);
        }
    }
    _createHelpContainer() {
        const content = `**Shuffle Help**\n\n` +
            `└─ **Shuffle:** Randomizes the order of all upcoming songs in your queue.\n` +
            `└─ **Preserves:** The currently playing song remains active without interruption.\n\n` +
            `*Use the buttons below to reshuffle or return.*`;
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId('shuffle_again')
            .setLabel('Shuffle Again')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emoji.get('shuffle') || "🔀"), new ButtonBuilder()
            .setCustomId('shuffle_back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get('reset') || "↩️"));
        return buildContainer({ image: undefined,
            title: "Shuffle Guide",
            content,
            components: [buttons],
            icon: emoji.get('info') || "ℹ️"
        });
    }
    // @ts-ignore
    _createSuccessContainer(pm) {
        const shuffleNote = phrases.get("shuffleSuccess");
        const content = `${emoji.get("check") || "✨"} **${shuffleNote}**\n\n` +
            `└─ **${emoji.get("folder") || "📁"} Tracks in Queue:** ${pm.queueSize}\n` +
            `└─ **${emoji.get("music") || "🎵"} Now Playing:** ${pm.currentTrack?.info?.title || "None"}`;
        const container = buildContainer({ image: undefined,
            title: "Queue Shuffled",
            content: content,
            thumbnail: config.assets.defaultThumbnail || config.assets.defaultTrackArtwork,
            icon: emoji.get("music") || "ℹ️"
        });
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId('shuffle_again')
            .setLabel('Shuffle Again')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emoji.get('shuffle') || "🔀"), new ButtonBuilder()
            .setCustomId('shuffle_help')
            .setLabel('Help')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get('info') || "ℹ️"));
        container.addActionRowComponents(buttons);
        return container;
    }
    _createErrorContainer(message) {
        return buildError(message);
    }
    // @ts-ignore
    _setupCollector(message, author) {
        const filter = (i) => i.user.id === author.id;
        const collector = message.createMessageComponentCollector({
            filter,
            time: 300_000,
        });
        collector.on("collect", async (interaction) => {
            try {
                await interaction.deferUpdate();
                if (interaction.customId === "shuffle_again") {
                    const player = interaction.client.music?.getPlayer(interaction.guild.id);
                    if (!player) {
                        await interaction.editReply({
                            components: [this._createErrorContainer('Queue is empty or player unavailable.')],
                        });
                        return;
                    }
                    const currentPm = new PlayerManager(player);
                    if (currentPm.queueSize < 1) {
                        await interaction.editReply({
                            components: [this._createErrorContainer('Queue is empty or player unavailable.')],
                        });
                        return;
                    }
                    await currentPm.shuffleQueue();
                    const updatedContainer = this._createSuccessContainer(currentPm);
                    await interaction.editReply({ components: [updatedContainer] });
                }
                else if (interaction.customId === "shuffle_help") {
                    await interaction.editReply({
                        components: [this._createHelpContainer()],
                    });
                }
                else if (interaction.customId === "shuffle_back") {
                    const player = interaction.client.music?.getPlayer(interaction.guild.id);
                    if (player) {
                        const currentPm = new PlayerManager(player);
                        const container = this._createSuccessContainer(currentPm);
                        await interaction.editReply({ components: [container] });
                    }
                }
            }
            catch (error) {
                logger.error("ShuffleCommand", "Collector Error:", error);
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
                });
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
            logger.debug("ShuffleCommand", `Message was deleted, cannot disable components. Reason: ${reason}`);
        }
        else if (error.code === 50001) {
            logger.warn("ShuffleCommand", `Missing permissions to edit message. Reason: ${reason}`);
        }
        else {
            logger.error("ShuffleCommand", `Error disabling components: ${error.message}. Reason: ${reason}`, error);
        }
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
            logger.error("ShuffleCommand", "Failed to reply in Shuffle command:", e);
            return null;
        }
    }
}
export default new ShuffleCommand();
