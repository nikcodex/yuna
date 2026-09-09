import { logger } from '#utils/logger';
export default {
    name: "disconnect",
    once: false,
    // @ts-ignore
    async execute(node, reason, payload, musicManager, client) {
        try {
            const code = reason?.code ?? 'unknown';
            const reasonStr = reason?.reason ?? JSON.stringify(reason) ?? 'unknown';
            logger.warn('LavalinkNode', `🔌 Lavalink Node #${node.id} disconnected. Code: ${code} Reason: ${reasonStr}`);
            const audioManager = client?.audio || musicManager;
            if (audioManager && typeof audioManager.failoverNode === 'function') {
                await audioManager.failoverNode(node);
            }
        }
        catch (error) {
            logger.error('LavalinkNode', 'Error in node disconnect event handler:', error);
        }
    }
};
