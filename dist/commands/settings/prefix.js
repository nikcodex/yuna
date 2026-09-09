import { Command } from '#core/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle, ThumbnailBuilder, } from "discord.js";
import { db } from "#database/Database";
import { config } from "#config/config";
import emoji from "#config/emoji";
import { logger } from "#utils/logger";
import { buildError, buildSuccess } from "#ui/Theme";
import phrases from "#utils/phrases";
const PREMIUM_PREFIX_LIMIT = 5;
const COMMON_PREFIXES = ["!", ".", "?", "$", "%", "^", "&", "*"];
class PrefixCommand extends Command {
    constructor() {
        super({
            name: "prefix",
            description: "View or change the bot prefix for this server.",
            usage: "prefix [new prefix]",
            aliases: ["setprefix"],
            category: "settings",
            examples: ["prefix", "prefix !", "setprefix $", "prefix ?"],
            cooldown: 1,
            access: {
                permissions: [PermissionFlagsBits.ManageMessages],
                botPermissions: [PermissionFlagsBits.SendMessages],
            },
            slash: {
                enabled: true,
                data: {
                    name: "prefix",
                    description: "View or change the bot prefix for this server.",
                    options: [
                        {
                            name: "set",
                            description: "Set a new prefix. This will overwrite it for standard servers.",
                            type: 3,
                            required: false,
                            max_length: 5,
                        },
                    ],
                },
            },
        });
    }
    async execute({ message: Message, args }) {
        // @ts-ignore
        await this._handleCommand(message, args[0]);
    }
    async slashExecute({ interaction }) {
        const newPrefix = interaction.options.getString("set");
        await this._handleCommand(interaction, newPrefix);
    }
    async _handleCommand(ctx, newPrefix) {
        const isPremium = db.isGuildPremium(ctx.guild.id);
        if (newPrefix) {
            await this._setPrefix(ctx, newPrefix, isPremium);
        }
        else {
            await this._showManagementUI(ctx, isPremium);
        }
    }
    async _setPrefix(ctx, newPrefix, isPremium) {
        if (newPrefix.length > 5) {
            return this._sendError(ctx, "Error", "Prefix is too long. Maximum 5 characters allowed.");
        }
        let prefixes = db.getPrefixes(ctx.guild.id);
        let updateMessage;
        if (isPremium) {
            if (prefixes.includes(newPrefix)) {
                return this._sendError(ctx, "Prefix Exists", `The prefix \`${newPrefix}\` is already set for this server.`);
            }
            if (prefixes.length >= PREMIUM_PREFIX_LIMIT) {
                return this._sendError(ctx, "Prefix Limit Reached", `Premium servers can have a maximum of ${PREMIUM_PREFIX_LIMIT} prefixes.`);
            }
            prefixes.push(newPrefix);
            updateMessage = `Successfully added new prefix: \`${newPrefix}\``;
        }
        else {
            prefixes = [newPrefix];
            updateMessage = `Server prefix has been updated to \`${newPrefix}\``;
        }
        // @ts-ignore
        db.setPrefixes(ctx.guild.id, prefixes);
        const replyOptions = this._createSuccessResponse("Prefix Updated", updateMessage, newPrefix);
        const isInteraction = !!ctx.user;
        if (isInteraction) {
            if (ctx.deferred || ctx.replied)
                await ctx.editReply(replyOptions);
            else
                await ctx.reply(replyOptions);
        }
        else {
            await ctx.channel.send(replyOptions);
        }
    }
    async _showManagementUI(ctx, isPremium) {
        const prefixes = db.getPrefixes(ctx.guild.id);
        const container = isPremium ? this._createPremiumContainer(prefixes) : this._createStandardContainer(prefixes[0]);
        const isInteraction = !!ctx.user;
        const replyOptions = {
            components: [container],
            fetchReply: true,
            flags: MessageFlags.IsComponentsV2,
        };
        let reply;
        if (isInteraction) {
            if (ctx.deferred || ctx.replied)
                reply = await ctx.editReply(replyOptions);
            else
                reply = await ctx.reply(replyOptions);
        }
        else {
            reply = await ctx.channel.send(replyOptions);
        }
        if (isPremium) {
            this._setupCollector(reply, isInteraction ? ctx.user.id : ctx.author.id, ctx.guild.id);
        }
    }
    _createStandardContainer(prefix) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emoji.get("info")} **Server Prefix**`));
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        const content = `**${emoji.get("check")} Current Default Prefix:** \`${prefix}\`\n\n` +
            `This prefix is used for all bot commands in this server.\n\n` +
            `**${emoji.get("folder")} Usage Examples:**\n` +
            `├─ \`${prefix}prefix new!\`\n` +
            `└─ \`/prefix set:new!\`\n\n` +
            `**${emoji.get("add")} Premium Features:**\n` +
            `└─ Multiple prefix support available with premium`;
        const section = new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork));
        container.addSectionComponents(section);
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        return container;
    }
    _createPremiumContainer(prefixes) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emoji.get("add")} **Premium Prefix Management**`));
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        // @ts-ignore
        const prefixList = prefixes.map((p) => `\`${p}\``).join(" ") || "None";
        const content = `**${emoji.get("check")} Current Prefixes (${prefixes.length}/${PREMIUM_PREFIX_LIMIT}):**\n${prefixList}\n\n` +
            `**${emoji.get("folder")} Premium Features:**\n` +
            `├─ Multiple prefix support\n` +
            `├─ Quick prefix switching\n` +
            `├─ Advanced customization\n` +
            `└─ Priority support access`;
        const section = new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork));
        container.addSectionComponents(section);
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        if (prefixes.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId("prefix_remove")
                .setPlaceholder("Select prefixes to remove...")
                .setMinValues(1)
                .setMaxValues(Math.min(prefixes.length, 5))
                .addOptions(
            // @ts-ignore
            prefixes.map((prefix) => ({
                label: `Remove ${prefix}`,
                value: prefix,
                description: `Remove the prefix "${prefix}" from this server`,
                emoji: emoji.get("cross"),
            })));
            container.addActionRowComponents(
            // @ts-ignore
            new ActionRowBuilder().addComponents(selectMenu));
        }
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId("prefix_add")
            .setLabel("Set New")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get("add"))
            .setDisabled(prefixes.length >= PREMIUM_PREFIX_LIMIT), new ButtonBuilder()
            .setCustomId("prefix_reset")
            .setLabel("Reset to Default")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get("reset")));
        // @ts-ignore
        container.addActionRowComponents(buttons);
        return container;
    }
    // @ts-ignore
    _setupCollector(message, userId, guildId) {
        const collector = message.createMessageComponentCollector({
            // @ts-ignore
            filter: (i) => i.user.id === userId,
            time: 300_000,
        });
        // @ts-ignore
        collector.on("collect", async (interaction) => {
            try {
                if (interaction.customId === "prefix_add") {
                    const modal = new ModalBuilder()
                        .setCustomId("prefix_add_modal")
                        .setTitle("Add New Prefix")
                        .addComponents(
                    // @ts-ignore
                    new ActionRowBuilder().addComponents(new TextInputBuilder()
                        .setCustomId("new_prefix_input")
                        .setLabel("New prefix (max 5 characters)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(5)
                        .setPlaceholder("Enter a new prefix...")));
                    await interaction.showModal(modal);
                    const modalSubmit = await interaction
                        .awaitModalSubmit({ time: 60_000 })
                        .catch(() => null);
                    if (!modalSubmit)
                        return;
                    const newPrefix = modalSubmit.fields.getTextInputValue("new_prefix_input").trim();
                    if (!newPrefix) {
                        return modalSubmit.reply({
                            content: `${emoji.get("cross")} Error: Prefix cannot be empty.`,
                            ephemeral: true,
                        });
                    }
                    if (newPrefix.length > 5) {
                        return modalSubmit.reply({
                            content: `${emoji.get("cross")} Error: Prefix is too long (max 5 characters).`,
                            ephemeral: true,
                        });
                    }
                    let prefixes = db.getPrefixes(guildId);
                    if (prefixes.includes(newPrefix)) {
                        return modalSubmit.reply({
                            content: `${emoji.get("cross")} Error: This prefix already exists.`,
                            ephemeral: true,
                        });
                    }
                    if (prefixes.length >= PREMIUM_PREFIX_LIMIT) {
                        return modalSubmit.reply({
                            content: `${emoji.get("cross")} Error: Prefix limit reached.`,
                            ephemeral: true,
                        });
                    }
                    prefixes.push(newPrefix);
                    // @ts-ignore
                    db.setPrefixes(guildId, prefixes);
                    await modalSubmit.deferUpdate();
                    const updatedContainer = this._createPremiumContainer(prefixes);
                    await message.edit({ components: [updatedContainer] });
                }
                else if (interaction.customId === "prefix_remove") {
                    const selectedPrefixes = interaction.values;
                    let prefixes = db.getPrefixes(guildId);
                    prefixes = prefixes.filter(p => !selectedPrefixes.includes(p));
                    if (prefixes.length === 0) {
                        prefixes = [config.prefix];
                    }
                    // @ts-ignore
                    db.setPrefixes(guildId, prefixes);
                    await interaction.deferUpdate();
                    const updatedContainer = this._createPremiumContainer(prefixes);
                    await message.edit({ components: [updatedContainer] });
                }
                else if (interaction.customId === "prefix_reset") {
                    const defaultPrefixes = [config.prefix];
                    // @ts-ignore
                    db.setPrefixes(guildId, defaultPrefixes);
                    await interaction.deferUpdate();
                    const updatedContainer = this._createPremiumContainer(defaultPrefixes);
                    await message.edit({ components: [updatedContainer] });
                }
            }
            catch (error) {
                logger.error("PrefixCollector", "An error occurred in the prefix collector:", error);
            }
        });
        collector.on("end", async () => {
            try {
                const fetchedMessage = await message.fetch().catch(() => null);
                if (fetchedMessage?.components.length > 0) {
                    await fetchedMessage.edit({
                        components: [this._createExpiredContainer()]
                    });
                }
            }
            catch (error) {
                // @ts-ignore
                if (error.code !== 10008) {
                    logger.error("PrefixCommand", "Failed to disable components on end:", error);
                }
            }
        });
    }
    _createSuccessResponse(title, description, prefix) {
        const note = phrases.get("prefixUpdated");
        let fullDescription = `${description}\n\n*${note}*`;
        if (COMMON_PREFIXES.includes(prefix)) {
            fullDescription += `\n\n**${emoji.get("folder")} Warning:** Using a common prefix like \`${prefix}\` may cause conflicts with other bots.`;
        }
        const container = buildSuccess(fullDescription, title);
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }
    _createExpiredContainer() {
        return buildError("This interaction has expired. Run the command again to manage prefix settings.", "Server Prefix");
    }
    async _sendError(ctx, title, description) {
        const container = buildError(description, title);
        const replyOptions = {
            components: [container],
            ephemeral: true,
            flags: MessageFlags.IsComponentsV2,
        };
        const isInteraction = !!ctx.user;
        try {
            if (isInteraction) {
                if (ctx.deferred || ctx.replied)
                    await ctx.editReply(replyOptions);
                else
                    await ctx.reply(replyOptions);
            }
            else {
                await ctx.channel.send(replyOptions);
            }
        }
        catch (error) {
            logger.error("PrefixError", "Failed to send error message:", error);
        }
    }
}
export default new PrefixCommand();
