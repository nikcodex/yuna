import type { Player, Track, LavalinkNode, LavalinkManager } from 'lavalink-client';
import type { YunaClient } from '#core/YunaClient';
import { logger } from '#utils/logger';

export default {
  name: "disconnect",
  once: false,
  async execute(node: LavalinkNode, reason: { code?: number | string; reason?: string }, payload: unknown, musicManager: LavalinkManager, client: YunaClient) {
    try {
      const code = reason?.code ?? 'unknown';
      const reasonStr = reason?.reason ?? JSON.stringify(reason) ?? 'unknown';
      logger.warn('LavalinkNode', `🔌 Lavalink Node #${node.id} disconnected. Code: ${code} Reason: ${reasonStr}`);

      // lavalink-client's NodeManager handles player migration internally on
      // node disconnect; there is no app-level failover to trigger here.
    } catch (error: any) {
      logger.error('LavalinkNode', 'Error in node disconnect event handler:', error);
    }
  }
};