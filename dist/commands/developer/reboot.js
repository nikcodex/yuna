import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, ThumbnailBuilder, } from "discord.js";
import { config } from "#config/config";
import { Command } from "#core/Command";
import emoji from "#config/emoji";
import { logger } from "#utils/logger";
import { buildError } from "#ui/Theme";
class RebootCommand extends Command {
    constructor() {
        super({
            name: "reboot",
            description: "Reboots the bot process or restarts clusters gracefully with session saving (Developer Only)",
            usage: "reboot",
            aliases: ["restart", "botrestart"],
            category: "developer",
            access: { ownerOnly: true },
        });
    }
    // @ts-ignore
    async execute({ client, message }) {
        try {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ⚠️ **Confirm Bot Reboot**`));
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
            const activePlayers = client.music?.lavalink?.players?.size || 0;
            const warningText = `Are you sure you want to reboot **Yuna**?\n\n` +
                `├─ **Active Players:** ${activePlayers} active music sessions\n` +
                `├─ **Connected Guilds:** ${client.guilds.cache.size}\n` +
                `└─ **Action:** Save all sessions and restart node process gracefully.`;
            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(warningText))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork));
            container.addSectionComponents(section);
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
            const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
                .setCustomId("reboot_confirm")
                .setLabel("Confirm Reboot")
                .setStyle(ButtonStyle.Danger), new ButtonBuilder()
                .setCustomId("reboot_cancel")
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary));
            container.addActionRowComponents(buttons);
            const msgInstance = await message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
            this._setupCollector(msgInstance, message.author.id, client);
        }
        catch (error) {
            logger.error("RebootCommand", "Error in reboot command", error);
            await message.reply({
                components: [buildError("An error occurred.")],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => { });
        }
    }
    // @ts-ignore
    _setupCollector(msgInstance, userId, client) {
        const collector = msgInstance.createMessageComponentCollector({
            // @ts-ignore
            filter: (i) => i.user.id === userId,
            time: 60_000,
        });
        // @ts-ignore
        collector.on("collect", async (interaction) => {
            try {
                if (interaction.customId === "reboot_cancel") {
                    const container = new ContainerBuilder();
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${emoji.get("cross")} **Reboot Cancelled**`));
                    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                    container.addSectionComponents(new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Reboot sequence cancelled by developer."))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail)));
                    await interaction.update({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
                else if (interaction.customId === "reboot_confirm") {
                    const container = new ContainerBuilder();
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🔄 **Rebooting Yuna Bot...**`));
                    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                    container.addSectionComponents(new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Saving active sessions and restarting process now..."))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail)));
                    await interaction.update({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                    });
                    logger.info("RebootCommand", "Reboot sequence initiated by developer.");
                    setTimeout(() => {
                        process.exit(0);
                    }, 1500);
                }
            }
            catch (error) {
                logger.error("RebootCommand", "Error in collector interaction", error);
            }
        });
    }
    _createErrorContainer(msg) {
        const container = new ContainerBuilder();
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${emoji.get("cross")} **Reboot Error**`));
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        container.addSectionComponents(new SectionBuilder()
            // @ts-ignore
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(msg))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail)));
        return container;
    }
}
export default new RebootCommand();
