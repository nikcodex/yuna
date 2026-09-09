import { Command } from '#core/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType, StringSelectMenuBuilder, UserSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, MentionableSelectMenuBuilder, } from "discord.js";
import { PlayerManager } from '#audio/PlayerManager';
import { config } from "#config/config";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import { buildContainer, buildError } from '#ui/Theme';
import phrases from "#utils/phrases";
class VolumeCommand extends Command {
    constructor() {
        super({
            name: "volume",
            description: "Adjust or view the music playback volume with an interactive control panel",
            usage: "volume [level]",
            aliases: ["v", "vol"],
            category: "music",
            examples: ["volume", "volume 50", "vol 100", "v 75"],
            cooldown: 2,
            access: {
                voice: true,
                sameVoice: true,
                player: true,
            },
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: "volume",
                    description: "View or set the player volume",
                    options: [
                        {
                            name: "level",
                            description: "A number between 0 and 150",
                            type: 4,
                            required: false,
                            min_value: 0,
                            max_value: 150,
                        },
                    ],
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
        let level;
        if (interaction) {
            const opt = interaction.options.getInteger("level");
            if (opt !== null && opt !== undefined)
                level = opt;
        }
        else if (args[0]) {
            level = parseInt(args[0], 10);
        }
        return this._handleVolume(client, context, activePm, level);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleVolume(client, context, pm, level) {
        if (typeof level === "number") {
            if (isNaN(level) || level < 0 || level > 150) {
                return this._reply(context, this._createErrorContainer(phrases.get("volumeInvalid")));
            }
            await pm.setVolume(level);
        }
        const message = await this._reply(context, this._buildVolumeContainer(pm));
        if (message) {
            this._setupCollector(message, client, pm.guildId);
        }
    }
    _buildVolumeContainer(pm) {
        const volume = pm.volume;
        const barLength = 15;
        const filledBlocks = Math.round((volume / 150) * barLength);
        const emptyBlocks = barLength - filledBlocks;
        const volumeBar = "█".repeat(filledBlocks) + "▒".repeat(emptyBlocks);
        const artworkUrl = pm.currentTrack?.info?.artworkUrl || config.assets.defaultTrackArtwork;
        const content = `**Current Settings**\n\n` +
            `└─ **${emoji.get("info")} Volume Level:** ${volume}%\n` +
            `└─ **${emoji.get("check")} Status:** ${volume === 0 ? "Muted" : "Active"}\n` +
            `└─ **${emoji.get("folder")} Range:** 0% - 150%\n` +
            `└─ **${emoji.get("reset")} Visual:** \`${volumeBar}\`\n\n` +
            `*Use the buttons below to adjust volume*`;
        return buildContainer({
            title: "Volume Control",
            content,
            thumbnail: artworkUrl,
            components: [this._createButtons(pm)],
            icon: emoji.get("music") || "🔊"
        });
    }
    _createButtons(pm) {
        const volume = pm.volume;
        const isMuted = volume === 0;
        return new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId(`vol_minus_10_${pm.guildId}`)
            .setLabel("-10")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(volume <= 0), new ButtonBuilder()
            .setCustomId(`vol_mute_${pm.guildId}`)
            .setLabel(isMuted ? "Unmute" : "Mute")
            .setStyle(isMuted ? ButtonStyle.Success : ButtonStyle.Danger), new ButtonBuilder()
            .setCustomId(`vol_plus_10_${pm.guildId}`)
            .setLabel("+10")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(volume >= 150));
    }
    // @ts-ignore
    async _setupCollector(message, client, guildId) {
        // @ts-ignore
        const filter = (i) => i.customId.startsWith("vol_") && i.customId.endsWith(guildId);
        const collector = message.createMessageComponentCollector({
            filter,
            time: 120_000,
        });
        // @ts-ignore
        collector.on("collect", async (interaction) => {
            await interaction.deferUpdate();
            const player = client.music?.getPlayer(guildId);
            if (!player) {
                collector.stop();
                return;
            }
            const pm = new PlayerManager(player);
            const action = interaction.customId.split("_")[1];
            switch (action) {
                case "minus":
                    await pm.setVolume(Math.max(0, pm.volume - 10));
                    break;
                case "plus":
                    await pm.setVolume(Math.min(150, pm.volume + 10));
                    break;
                case "mute":
                    if (pm.volume > 0) {
                        // @ts-ignore
                        pm.setData("oldVolume", pm.volume);
                        await pm.setVolume(0);
                    }
                    else {
                        // @ts-ignore
                        const oldVolume = pm.getData("oldVolume") || 100;
                        await pm.setVolume(oldVolume);
                    }
                    break;
            }
            const newContainer = this._buildVolumeContainer(pm);
            await interaction.editReply({ components: [newContainer] });
        });
        // @ts-ignore
        collector.on("end", async (collected, reason) => {
            if (reason === "limit" || reason === "messageDelete")
                return;
            try {
                const currentMessage = await this._fetchMessage(message).catch(() => null);
                if (!currentMessage?.components?.length) {
                    return;
                }
                const success = await this._disableAllComponents(currentMessage);
                if (success) {
                    logger.debug("VolumeCommand", `Components disabled successfully. Reason: ${reason}`);
                }
            }
            catch (error) {
                this._handleDisableError(error, reason);
            }
        });
        // @ts-ignore
        collector.on("dispose", async (interaction) => {
            logger.debug("VolumeCommand", `Interaction disposed: ${interaction.customId}`);
        });
    }
    // @ts-ignore
    async _disableAllComponents(message) {
        try {
            const disabledComponents = this._processComponents(message.components);
            await message.edit({
                components: disabledComponents,
                flags: MessageFlags.IsComponentsV2,
            });
            return true;
        }
        catch (error) {
            logger.error("VolumeCommand", 
            // @ts-ignore
            `Failed to disable components: ${error.message}`, error);
            return false;
        }
    }
    _processComponents(components) {
        // @ts-ignore
        return components.map((component) => {
            if (component.type === ComponentType.ActionRow) {
                return {
                    ...component.toJSON(),
                    // @ts-ignore
                    components: component.components.map((subComponent) => ({
                        ...subComponent.toJSON(),
                        disabled: true,
                    })),
                };
            }
            if (component.type === ComponentType.Container) {
                return {
                    ...component.toJSON(),
                    components: this._processComponents(component.components),
                };
            }
            if (component.type === ComponentType.Section) {
                const processedComponent = {
                    ...component.toJSON(),
                    components: this._processComponents(component.components),
                };
                if (component.accessory &&
                    component.accessory.type === ComponentType.Button) {
                    processedComponent.accessory = {
                        ...component.accessory.toJSON(),
                        disabled: true,
                    };
                }
                return processedComponent;
            }
            return component.toJSON();
        });
    }
    _handleDisableError(error, reason) {
        if (error.code === 10008) {
            logger.debug("VolumeCommand", `Message was deleted, cannot disable components. Reason: ${reason}`);
        }
        else if (error.code === 50001) {
            logger.warn("VolumeCommand", `Missing permissions to edit message. Reason: ${reason}`);
        }
        else {
            logger.error("VolumeCommand", `Error disabling components: ${error.message}. Reason: ${reason}`, error);
        }
    }
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
    _shouldDisableComponent(component) {
        const selectMenuTypes = [
            StringSelectMenuBuilder,
            UserSelectMenuBuilder,
            RoleSelectMenuBuilder,
            ChannelSelectMenuBuilder,
            MentionableSelectMenuBuilder,
        ];
        if (selectMenuTypes.some((type) => component instanceof type)) {
            return true;
        }
        if (component instanceof ButtonBuilder) {
            return component.data.style !== ButtonStyle.Link;
        }
        return false;
    }
    // @ts-ignore
    _createErrorContainer(message) {
        return buildError(message);
    }
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true,
        };
        try {
            // @ts-ignore
            if (context.editReply && (context.deferred || context.replied)) {
                // @ts-ignore
                return await context.editReply(payload);
            }
            // @ts-ignore
            return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
        }
        catch (e) {
            logger.error("VolumeCommand", "Failed to reply in Volume command:", e);
            return null;
        }
    }
}
export default new VolumeCommand();
