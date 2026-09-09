import { logger } from "#utils/logger";
export default {
    name: "playerCreate",
    once: false,
    // @ts-ignore
    async execute(player) {
        try {
            logger.info("PlayerCreate", `🎵 Player created for guild: ${player.guildId}`);
        }
        catch (error) {
            logger.error("PlayerCreate", "Error in playerCreate event:", error);
        }
    },
};
