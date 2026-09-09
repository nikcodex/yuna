import { logger } from '#utils/logger';
export default {
    name: "error",
    once: false,
    async execute(node, error, payload, musicManager, client) {
        try {
            if (payload) {
                logger.error('LavalinkNode', `📦 Error Payload:`, payload?.message || payload);
            }
        }
        catch (error_) {
            logger.error('LavalinkNode', 'Error in node error event handler:', error_);
        }
    }
};
