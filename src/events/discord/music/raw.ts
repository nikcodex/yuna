import { logger } from "#utils/logger";

export default {
  name: "raw",
  once: false,
  async execute(data: any, client: any) {
    try {
      if (!data) return;

      if (data.t === "VOICE_STATE_UPDATE" || data.t === "VOICE_SERVER_UPDATE") {
        logger.info("RawVoice", `Received ${data.t} for guild: ${data.d?.guild_id || "unknown"} (User ID: ${data.d?.user_id})`);
      }

      const lavalink = client?.audio?.lavalink || client?.music?.lavalink;
      if (lavalink && typeof lavalink.sendRawData === 'function') {
        lavalink.sendRawData(data);
      }
    } catch (error) {
      logger.error("LavalinkClient", "Error in raw event handler:", error);
    }
  },
};
