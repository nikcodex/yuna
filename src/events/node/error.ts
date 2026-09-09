import type { Player, Track, LavalinkNode, LavalinkManager } from 'lavalink-client';
import type { YunaClient } from '#core/YunaClient';
import { logger } from '#utils/logger';

export default {
	name: "error",
	once: false,
	async execute(node: any, error: any, payload: any, musicManager: LavalinkManager, client: YunaClient) {
		try {
			if (payload) {
				logger.error('LavalinkNode', `📦 Error Payload:`, payload?.message || payload);
			}
		} catch (error_: any) {
			logger.error('LavalinkNode', 'Error in node error event handler:', error_);
		}
	}
};