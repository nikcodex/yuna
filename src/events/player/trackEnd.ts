import type { Player, Track, LavalinkNode, LavalinkManager } from 'lavalink-client';
import type { YunaClient } from '#core/YunaClient';
import { logger } from "#utils/logger";
import { EventUtils } from "#utils/EventUtils";

export default {
	name: "trackEnd",
	once: false,
	async execute(player: Player, track: Track, payload: any, musicManager: LavalinkManager, client: YunaClient) {
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

			const messageId = player.get<string | null>("nowPlayingMessageId");
			const channelId = player.get<string | null>("nowPlayingChannelId");
			const stuckWarningId = player.get<string | null>("stuckWarningMessageId");
			const errorMessageId = player.get<string | null>("errorMessageId");

			// Delete Now Playing message immediately when track ends
			if (messageId && channelId) {
				await EventUtils.deleteMessage(client, channelId, messageId).catch(() => {});
			}

			if (stuckWarningId && channelId) {
				await EventUtils.deleteMessage(client, channelId, stuckWarningId).catch(() => {});
			}

			if (errorMessageId && channelId) {
				await EventUtils.deleteMessage(client, channelId, errorMessageId).catch(() => {});
			}

			// Reset all message tracking state on the player
			player.set("nowPlayingMessageId", null);
			player.set("nowPlayingChannelId", null);
			player.set("stuckWarningMessageId", null);
			player.set("errorMessageId", null);
			player.set("stuckTimeoutId", null);

			if (endReason === "FINISHED" && track?.info) {
				logger.info(
					"TrackEnd",
					`Track completed: "${track.info.title}" by ${track.info.author} in guild ${player.guildId}`,
				);
			}
		} catch (error: any) {
			logger.error("TrackEnd", "Error in trackEnd event:", error);
		}
	},
};