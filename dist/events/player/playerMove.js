import { logger } from "#utils/logger";
export default {
    name: "playerMove",
    once: false,
    // @ts-ignore
    async execute(player, oldChannelId, newChannelId) {
        try {
            logger.info("LavalinkPlayer", `🚚 Player moved: ${oldChannelId} → ${newChannelId}`);
        }
        catch (error) {
            logger.error("PlayerMove", "Error in playerMove event:", error);
        }
    },
};
