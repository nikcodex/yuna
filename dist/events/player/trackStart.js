import { AttachmentBuilder, MessageFlags } from 'discord.js';
import { EventUtils } from '#utils/EventUtils';
import { db } from '#database/Database';
import { PlayerManager } from '#audio/PlayerManager';
import MusicCard from '#ui/cards/MusicCard';
import { logger } from '#utils/logger';
import { DiscordLogger } from '#utils/DiscordLogger';
import { createPlayerContainer } from '#ui/Components';
export default {
    name: "trackStart",
    once: false,
    async execute(player, track, payload, musicManager, client) {
        try {
            if (!track || !track.info) {
                logger.error('TrackStart', 'Invalid track data received:', track);
                return;
            }
            player.set('lastPlayedTrack', track);
            player.set('controlMode', 'default');
            EventUtils.clearPlayerTimeout(player, 'disconnectTimeoutId');
            new PlayerManager(player).saveSession();
            DiscordLogger.logMusic(client, { event: 'Track Started', guild: client.guilds.cache.get(player.guildId), track, requester: track.requester });
            if (!player.get('sessionStartTime')) {
                player.set('sessionStartTime', Date.now());
                player.set('totalTracksPlayed', 0);
            }
            const currentCount = player.get('totalTracksPlayed') || 0;
            // @ts-ignore
            player.set('totalTracksPlayed', currentCount + 1);
            // @ts-ignore
            if (track.requester?.id && track.info.identifier) {
                try {
                    // @ts-ignore
                    db.user.addTrackToHistory(track.requester.id, track.info);
                    // @ts-ignore
                    db.stats.logTrackPlay(track.requester.id, track.info);
                }
                catch (historyError) {
                    logger.error('TrackStart', 'Error adding track to history/stats:', historyError);
                }
            }
            // Delete previous Now Playing message if one still exists
            const oldMessageId = player.get('nowPlayingMessageId');
            const oldChannelId = player.get('nowPlayingChannelId');
            EventUtils.clearPlayerInterval(player, 'updateInterval');
            if (oldMessageId && oldChannelId) {
                // @ts-ignore
                await EventUtils.deleteMessage(client, oldChannelId, oldMessageId).catch(() => { });
                player.set('nowPlayingMessageId', null);
                player.set('nowPlayingChannelId', null);
            }
            let message;
            // @ts-ignore
            const style = track.requester?.id ? db.getNpStyle(track.requester.id) : 'card';
            const isTextMode = style === 'text';
            const container = createPlayerContainer('default', { isTextMode, track, position: player.position || 0 });
            try {
                if (isTextMode) {
                    message = await EventUtils.sendPlayerMessage(client, player, {
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
                else {
                    const musicCard = new MusicCard();
                    // @ts-ignore
                    const requesterId = track.requester?.id;
                    const isPremium = requesterId ? !!db.hasAnyPremium(requesterId, player.guildId) : false;
                    const buffer = await musicCard.createMusicCard(track, 0, { isPremium });
                    const attachment = new AttachmentBuilder(buffer, { name: 'yuna-nowplaying.png' });
                    message = await EventUtils.sendPlayerMessage(client, player, {
                        files: [attachment],
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
            catch (err) {
                logger.error('TrackStart', 'Error creating player view:', err);
                message = await EventUtils.sendPlayerMessage(client, player, {
                    content: `🎵 **Now Playing**\n**${track.info.title}** by **${track.info.author}**`,
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            if (message?.id) {
                player.set('nowPlayingMessageId', message.id);
                player.set('nowPlayingChannelId', player.textChannelId);
            }
            logger.info('TrackStart', `Track started: "${track.info.title}" by ${track.info.author} in guild ${player.guildId}`);
        }
        catch (error) {
            logger.error('TrackStart', 'Error in trackStart event:', error);
        }
    }
};
