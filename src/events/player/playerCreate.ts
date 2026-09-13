import type { Player, Track, LavalinkNode, LavalinkManager } from 'lavalink-client';
import type { YunaClient } from '#core/YunaClient';
import { logger } from "#utils/logger";
import { EventUtils } from "#utils/EventUtils";

export default {
	name: "playerCreate",
	once: false,
	async execute(player: Player) {
		try {
			logger.info(
				"PlayerCreate",
				`🎵 Player created for guild: ${player.guildId}`,
			);
		} catch (error: any) {
			logger.error("PlayerCreate", "Error in playerCreate event:", error);
		}
	},
};

// Made by Nikhil Under CodeX Devs
