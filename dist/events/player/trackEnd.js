import { logger } from "#utils/logger";
import { EventUtils } from "#utils/EventUtils";
export default {
    name: "trackEnd",
    once: false,
    async execute(player, track, payload, musicManager, client) {
        try {
            const endReason = payload?.reason || "FINISHED";
            logger.debug("TrackEnd", `Track ended in guild ${player.guildId}:`, {
                track: track?.info?.title || "Unknown",
                reason: endReason,
                guildId: player.guildId,
            });
            // Clear active update interval and stuck timeouts
            EventUtils.clearPlayerTimeout(player, "stuckTimeoutId");
            EventUtils.clearPlayerInterval(player, "updateInterval");
            const messageId = player.get("nowPlayingMessageId");
            const channelId = player.get("nowPlayingChannelId");
            const stuckWarningId = player.get("stuckWarningMessageId");
            const errorMessageId = player.get("errorMessageId");
            // Delete Now Playing message immediately when track ends
            if (messageId && channelId) {
                // @ts-ignore
                await EventUtils.deleteMessage(client, channelId, messageId).catch(() => { });
            }
            if (stuckWarningId && channelId) {
                // @ts-ignore
                await EventUtils.deleteMessage(client, channelId, stuckWarningId).catch(() => { });
            }
            if (errorMessageId && channelId) {
                // @ts-ignore
                await EventUtils.deleteMessage(client, channelId, errorMessageId).catch(() => { });
            }
            // Reset all message tracking state on the player
            player.set("nowPlayingMessageId", null);
            player.set("nowPlayingChannelId", null);
            player.set("stuckWarningMessageId", null);
            player.set("errorMessageId", null);
            player.set("stuckTimeoutId", null);
            if (endReason === "FINISHED" && track?.info) {
                logger.info("TrackEnd", `Track completed: "${track.info.title}" by ${track.info.author} in guild ${player.guildId}`);
            }
        }
        catch (error) {
            logger.error("TrackEnd", "Error in trackEnd event:", error);
        }
    },
};
