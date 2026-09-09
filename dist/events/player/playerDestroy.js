import { logger } from "#utils/logger";
import { EventUtils } from "#utils/EventUtils";
import { db } from "#database/Database";
import { ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, } from "discord.js";
export default {
    name: "playerDestroy",
    once: false,
    // @ts-ignore
    async execute(player, reason, client) {
        try {
            logger.info("playerDestroy", `🎵 Player destroyed for guild: ${player.guildId},reason : ${reason}`);
            EventUtils.clearPlayerInterval(player, 'updateInterval');
            db.guild.deleteActiveSession(player.guildId);
            if (client && player.textChannelId) {
                const button = new ButtonBuilder()
                    .setLabel("Support")
                    .setURL("https://discord.gg/XYwwyDKhec")
                    .setStyle(ButtonStyle.Link);
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ⏹️ Player Disconnected`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                    .addSectionComponents(new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Reason:** ${reason || "Session ended"}\n\n*Use \`.play\` or \`/play\` anytime to start listening again!*`))
                    .setButtonAccessory(button));
                await EventUtils.sendPlayerMessage(client, player, {
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        }
        catch (error) {
            logger.error("playerDestroy", "Error in playerDestroy event:", error);
        }
    },
};
