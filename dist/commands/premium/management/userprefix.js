import { Command } from '#core/Command';
import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
import { db } from "#database/Database";
import emoji from "#config/emoji";
import { config } from "#config/config";
import { logger } from "#utils/logger";
import phrases from "#utils/phrases";
const USER_PREFIX_LIMIT = 3;
class UserPrefixCommand extends Command {
    constructor() {
        super({
            name: "userprefix",
            description: "Manage your personal command prefixes (Premium Only).",
            usage: "userprefix [prefix]",
            aliases: ["up", "myprefix"],
            category: "settings",
            examples: ["userprefix", "userprefix !", "up $"],
            cooldown: 5,
            access: {
                premium: 'user',
            },
            slash: {
                enabled: true,
                data: {
                    name: "userprefix",
                    description: "Manage your personal command prefixes (Premium Only).",
                    options: [
                        {
                            name: "add",
                            description: "Add a new personal prefix.",
                            type: 3,
                            required: false,
                            max_length: 5,
                        },
                    ],
                },
            },
        });
    }
    // @ts-ignore
    _buildUIManagementContainer(username, prefixes = [], actionMessage = null) {
        let content = `**Hello ${username}!** Manage your personal command prefixes here.\n\n`;
        if (actionMessage) {
            content += `${actionMessage}\n\n`;
        }
        content += `**${emoji.get("folder")} Your Prefixes (${prefixes.length}/${USER_PREFIX_LIMIT}):**\n`;
        if (prefixes.length > 0) {
            prefixes.forEach((prefix, index) => {
                const isLast = index === prefixes.length - 1;
                content += `${isLast ? '└─' : '├─'} \`${prefix}\`\n`;
            });
        }
        else {
            content += `└─ ${emoji.get("cross")} No custom prefixes set\n`;
        }
        content += `\n**${emoji.get("check")} How it works:**\n`;
        content += `└─ These prefixes work for you in any server where I am present\n`;
        content += `└─ Use them instead of the server's default prefix\n`;
        content += `└─ Maximum ${USER_PREFIX_LIMIT} prefixes allowed per user\n\n`;
        content += `**${emoji.get("add")} Examples:**\n`;
        content += `└─ Add \`.\` as prefix → Use \`.play song\` anywhere\n`;
        content += `└─ Add \`.\` as prefix → Use \`.help\` anywhere\n`;
        content += `└─ Add \`y!\` as prefix → Use \`y!queue\` anywhere`;
        const components = [];
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId("up_add")
            .setLabel("Add Prefix")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get("add"))
            .setDisabled(prefixes.length >= USER_PREFIX_LIMIT), new ButtonBuilder()
            .setCustomId("up_remove_all")
            .setLabel("Remove All")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get("reset"))
            .setDisabled(prefixes.length === 0)));
        if (prefixes.length > 0) {
            components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
                .setCustomId("up_remove_select")
                .setPlaceholder("Select specific prefixes to remove...")
                .setMinValues(1)
                .setMaxValues(prefixes.length)
                .addOptions(prefixes.map((p) => ({
                label: `Remove prefix: "${p}"`,
                value: p,
                emoji: emoji.get("cross"),
            })))));
        }
        return buildContainer({
            title: "Personal Prefix Management",
            content,
            thumbnail: config.assets.defaultThumbnail,
            icon: emoji.get("info"),
            components
        });
    }
    // @ts-ignore
    async _sendResponse(ctx, isSuccess, message) {
        const container = isSuccess ? buildSuccess(message) : buildError(message);
        const replyOptions = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: !isSuccess,
        };
        if (ctx.user) {
            if (ctx.deferred || ctx.replied)
                await ctx.editReply(replyOptions);
            else
                await ctx.reply(replyOptions);
        }
        else {
            await ctx.channel.send(replyOptions);
        }
    }
    async _addPrefix(userId, newPrefix) {
        if (!newPrefix || newPrefix.trim() === "") {
            return {
                success: false,
                message: phrases.get("invalidOption"),
            };
        }
        const trimmedPrefix = newPrefix.trim();
        if (trimmedPrefix.length > 5) {
            return {
                success: false,
                message: `Maximum 5 characters allowed per prefix.`,
            };
        }
        const currentPrefixes = db.getUserPrefixes(userId);
        if (currentPrefixes.length >= USER_PREFIX_LIMIT) {
            return {
                success: false,
                message: `You can only have ${USER_PREFIX_LIMIT} custom prefixes. Remove some existing prefixes first.`,
            };
        }
        if (currentPrefixes.includes(trimmedPrefix)) {
            return {
                success: false,
                message: `The prefix \`${trimmedPrefix}\` is already in your list.`,
            };
        }
        const newPrefixes = [...currentPrefixes, trimmedPrefix];
        // @ts-ignore
        db.users.setUserPrefixes(userId, newPrefixes);
        const note = phrases.get("prefixUpdated");
        return {
            success: true,
            message: `Prefix \`${trimmedPrefix}\` has been added to your personal prefixes.\n\n*${note}*`,
            prefixes: newPrefixes,
        };
    }
    // @ts-ignore
    async _handleCommand(ctx, directPrefix = null) {
        const isInteraction = !!ctx.user;
        const author = isInteraction ? ctx.user : ctx.author;
        const userId = author.id;
        const username = author.username;
        if (directPrefix) {
            const result = await this._addPrefix(userId, directPrefix);
            return this._sendResponse(ctx, result.success, result.message);
        }
        const replyOptions = {
            components: [this._buildUIManagementContainer(username, db.getUserPrefixes(userId))],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true,
        };
        let message;
        if (isInteraction) {
            if (ctx.deferred || ctx.replied)
                message = await ctx.editReply(replyOptions);
            else
                message = await ctx.reply(replyOptions);
        }
        else {
            message = await ctx.channel.send(replyOptions);
        }
        this._setupCollector(message, userId, username);
    }
    async execute({ message: Message, args }) {
        // @ts-ignore
        await this._handleCommand(message, args[0]);
    }
    async slashExecute({ interaction }) {
        await this._handleCommand(interaction, interaction.options.getString("add"));
    }
    // @ts-ignore
    _setupCollector(message, userId, username) {
        const collector = message.createMessageComponentCollector({
            // @ts-ignore
            filter: (i) => i.user.id === userId,
            time: 300_000,
        });
        // @ts-ignore
        collector.on("collect", async (interaction) => {
            try {
                let prefixes = db.getUserPrefixes(userId);
                let actionMessage = null;
                if (interaction.customId === "up_add") {
                    const modal = new ModalBuilder()
                        .setCustomId("up_add_modal")
                        .setTitle("Add Personal Prefix")
                        .addComponents(
                    // @ts-ignore
                    new ActionRowBuilder().addComponents(new TextInputBuilder()
                        .setCustomId("new_prefix_input")
                        .setLabel("New Prefix (max 5 characters)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(5)
                        .setPlaceholder("Enter your custom prefix...")));
                    await interaction.showModal(modal);
                    try {
                        const modalSubmit = await interaction.awaitModalSubmit({ time: 60000 });
                        const newPrefix = modalSubmit.fields.getTextInputValue("new_prefix_input");
                        const result = await this._addPrefix(userId, newPrefix);
                        prefixes = db.getUserPrefixes(userId);
                        actionMessage = result.message;
                        await modalSubmit.update({
                            // @ts-ignore
                            components: [this._buildUIManagementContainer(username, prefixes, actionMessage)],
                        });
                    }
                    catch (error) {
                        return;
                    }
                }
                else if (interaction.customId === "up_remove_all") {
                    await interaction.deferUpdate();
                    // @ts-ignore
                    db.users.setUserPrefixes(userId, []);
                    prefixes = [];
                    actionMessage = `${emoji.get("check")} **All Prefixes Removed**\n\nAll custom prefixes have been successfully removed from your account.`;
                    await interaction.editReply({
                        // @ts-ignore
                        components: [this._buildUIManagementContainer(username, prefixes, actionMessage)],
                    });
                }
                else if (interaction.isStringSelectMenu() && interaction.customId === "up_remove_select") {
                    await interaction.deferUpdate();
                    const valuesToRemove = interaction.values;
                    // @ts-ignore
                    prefixes = prefixes.filter((p) => !valuesToRemove.includes(p));
                    // @ts-ignore
                    db.users.setUserPrefixes(userId, prefixes);
                    // @ts-ignore
                    const removedList = valuesToRemove.map((p) => `\`${p}\``).join(", ");
                    actionMessage = `${emoji.get("check")} **Prefixes Removed**\n\nSuccessfully removed: ${removedList}`;
                    await interaction.editReply({
                        // @ts-ignore
                        components: [this._buildUIManagementContainer(username, prefixes, actionMessage)],
                    });
                }
            }
            catch (error) {
                logger.error("UserPrefix", "Collector Error:", error);
            }
        });
        collector.on("end", async () => {
            try {
                const fetchedMessage = await message.fetch().catch(() => null);
                if (fetchedMessage?.components.length > 0) {
                    // @ts-ignore
                    const disabledComponents = fetchedMessage.components.map((row) => {
                        const newRow = ActionRowBuilder.from(row);
                        newRow.components.forEach((component) => {
                            // @ts-ignore
                            if (component.data.style !== ButtonStyle.Link) {
                                // @ts-ignore
                                component.setDisabled(true);
                            }
                        });
                        return newRow;
                    });
                    await fetchedMessage.edit({ components: disabledComponents });
                }
            }
            catch (error) {
                // @ts-ignore
                if (error.code !== 10008) {
                    logger.error("UserPrefix", "Failed to disable components on end:", error);
                }
            }
        });
    }
}
export default new UserPrefixCommand();
