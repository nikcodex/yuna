import type { Player, Track, LavalinkNode, LavalinkManager } from 'lavalink-client';
import type { YunaClient } from '#core/YunaClient';
import { logger } from '#utils/logger';

export default {
	name: "connect",
	once: false,
	async execute(node: any, payload: any, musicManager: LavalinkManager, client: YunaClient) {
		try {
			logger.success('LavalinkNode', `✅ Lavalink Node #${node.id} connected successfully`);
			logger.info('LavalinkNode', `🌐 Node: ${node.options.host}:${node.options.port}`);
		} catch (error: any) {
			logger.error('LavalinkNode', 'Error in node connect event handler:', error);
		}
	}
};

// Made by Nikhil Under CodeX Devs
