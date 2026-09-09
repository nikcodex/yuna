import { logger } from '#utils/logger';
export class EventUtils {
    /**
     * Safely clears a timeout stored on the player object
     * @param {any} player
     * @param {string} timeoutName
     */
    static clearPlayerTimeout(player, timeoutName) {
        if (player && player.get && player.get(timeoutName)) {
            clearTimeout(player.get(timeoutName));
            player.set(timeoutName, null);
        }
    }
    /**
     * Safely clears an interval stored on the player object
     * @param {any} player
     * @param {string} intervalName
     */
    static clearPlayerInterval(player, intervalName) {
        if (player && player.get && player.get(intervalName)) {
            clearInterval(player.get(intervalName));
            player.set(intervalName, null);
        }
    }
    /**
     * Deletes a discord message safely
     * @param {Client} client
     * @param {string} channelId
     * @param {string} messageId
     */
    static async deleteMessage(client, channelId, messageId) {
        if (!client || !channelId || !messageId)
            return;
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel && channel.messages) {
                const msg = await channel.messages.fetch(messageId).catch(() => null);
                if (msg && msg.deletable) {
                    await msg.delete().catch(() => { });
                }
            }
        }
        catch (err) {
            logger.debug('EventUtils', `Failed to delete message: ${err.message}`);
        }
    }
    /**
     * Sends a message to the player's text channel
     * @param {Client} client
     * @param {any} player
     * @param {MessageCreateOptions | MessagePayload | string | any} messageOptions
     */
    static async sendPlayerMessage(client, player, messageOptions) {
        if (!client || !player || !player.textChannelId)
            return null;
        try {
            const channel = await client.channels.fetch(player.textChannelId).catch(() => null);
            if (channel && typeof channel.send === 'function') {
                return await channel.send(messageOptions);
            }
        }
        catch (err) {
            logger.error('EventUtils', `Failed to send player message: ${err.message}`, err);
        }
        return null;
    }
}
export default EventUtils;
