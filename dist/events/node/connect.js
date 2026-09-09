import { logger } from '#utils/logger';
export default {
    name: "connect",
    once: false,
    async execute(node, payload, musicManager, client) {
        try {
            logger.success('LavalinkNode', `✅ Lavalink Node #${node.id} connected successfully`);
            logger.info('LavalinkNode', `🌐 Node: ${node.options.host}:${node.options.port}`);
        }
        catch (error) {
            logger.error('LavalinkNode', 'Error in node connect event handler:', error);
        }
    }
};
