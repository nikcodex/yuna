import { Command } from '#core/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, } from "discord.js";
import { buildContainer, buildError } from "#ui/Theme";
import { config } from "#config/config";
import emoji from "#config/emoji";
import { logger } from "#utils/logger";
class InviteCommand extends Command {
    constructor() {
        super({
            name: "invite",
            description: "Get the bot's invite link to add it to your server.",
            usage: "invite",
            aliases: ["inv", "add", "addbot"],
            category: "info",
            examples: ["invite", "inv"],
            cooldown: 5,
            slash: {
                enabled: true,
                data: {
                    name: "invite",
                    description: "Get the bot's invite link to add it to your server.",
                },
            },
        });
    }
    async execute({ client: Client, message }) {
        try {
            await message.reply({
                // @ts-ignore
                components: [this._createInviteContainer(client)],
                flags: MessageFlags.IsComponentsV2,
            });
        }
        catch (error) {
            // @ts-ignore
            logger.error("InviteCommand", `Error in prefix command: ${error.message}`, error);
            await message.reply({
                components: [this._createErrorContainer("An error occurred while generating invite link.")],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => { });
        }
    }
    async slashExecute({ client: Client, interaction }) {
        try {
            await interaction.reply({
                // @ts-ignore
                components: [this._createInviteContainer(client)],
                flags: MessageFlags.IsComponentsV2,
            });
        }
        catch (error) {
            // @ts-ignore
            logger.error("InviteCommand", `Error in slash command: ${error.message}`, error);
            const errorPayload = {
                components: [this._createErrorContainer("An error occurred while generating invite link.")],
                ephemeral: true,
            };
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(errorPayload).catch(() => { });
            }
            else {
                await interaction.reply(errorPayload).catch(() => { });
            }
        }
    }
    // @ts-ignore
    _createInviteContainer(client) {
        const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
        const content = `**Add Yuna to your server!**\n\n` +
            `*Click the button below to add Yuna to your server!*`;
        const buttonRow = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setLabel('Add to Server')
            .setStyle(ButtonStyle.Link)
            .setURL(inviteLink)
            .setEmoji(emoji.get("add")));
        return buildContainer({
            title: "Invite Yuna",
            content,
            thumbnail: config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork,
            components: [buttonRow],
            icon: emoji.get("add") || "🔗"
        });
    }
    // @ts-ignore
    _createErrorContainer(message) {
        return buildError(message);
    }
}
export default new InviteCommand();
