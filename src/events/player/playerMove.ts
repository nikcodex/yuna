import type { Player, Track, LavalinkNode, LavalinkManager } from 'lavalink-client';
import type { YunaClient } from '#core/YunaClient';
import { logger } from "#utils/logger";
import { EventUtils } from "#utils/EventUtils";

export default {
	name: "playerMove",
	once: false,
	async execute(player: Player, oldChannelId: string | null, newChannelId: string | null) {
		try {
			logger.info(
				"LavalinkPlayer",
				`🚚 Player moved: ${oldChannelId} → ${newChannelId}`,
			);
		} catch (error: any) {
			logger.error("PlayerMove", "Error in playerMove event:", error);
		}
	},
};

// Made by Nikhil Under CodeX Devs
