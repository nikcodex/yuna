import { logger } from "#utils/logger";
import { db } from '#database/Database';
import { config } from "#config/config";
import { PlayerManager } from "#audio/PlayerManager";
import { EventUtils } from "#utils/EventUtils";
import { buildYunaContainer } from '#ui/Theme';
import { ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import emoji from "#config/emoji";
import AutoplayEngine from "#audio/AutoplayEngine";
// @ts-ignore
const autoplayEngine = new AutoplayEngine();
export default {
    name: "queueEnd",
    once: false,
    async execute(player, track, payload, musicManager, client) {
        try {
            logger.info('QueueEnd', `Queue ended in guild ${player.guildId}`);
            const messageId = player.get('nowPlayingMessageId');
            const channelId = player.get('nowPlayingChannelId');
            EventUtils.clearPlayerTimeout(player, 'stuckTimeoutId');
            EventUtils.clearPlayerInterval(player, 'updateInterval');
            if (messageId && channelId) {
                // @ts-ignore
                await EventUtils.deleteMessage(client, channelId, messageId).catch(() => { });
                player.set('nowPlayingMessageId', null);
                player.set('nowPlayingChannelId', null);
            }
            const autoplayEnabled = player.get('autoplayEnabled') || false;
            const lastTrack = player.get('lastPlayedTrack') || track;
            if (autoplayEnabled && lastTrack) {
                logger.info('QueueEnd', `Autoplay enabled - attempting to add similar tracks for guild ${player.guildId}`);
                try {
                    await handleAutoplay(player, lastTrack, client);
                    return;
                }
                catch (autoplayError) {
                    logger.error('QueueEnd', 'Autoplay failed:', autoplayError);
                    const failContainer = buildYunaContainer({
                        title: "Autoplay Failed",
                        content: `Unable to find similar songs. Queue has ended.\n\n` +
                            // @ts-ignore
                            `├─ **Reason:** ${autoplayError.message || 'Unknown error'}\n` +
                            `└─ **Tip:** Try playing a different song and enable autoplay again.`,
                        thumbnail: config.assets?.defaultThumbnail,
                        icon: "⚠️"
                    });
                    await EventUtils.sendPlayerMessage(client, player, {
                        components: [failContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
            let shouldDisconnect = true;
            let is247Mode = false;
            try {
                const guild247Settings = db.guild.get247Settings(player.guildId);
                is247Mode = guild247Settings.enabled;
                shouldDisconnect = !is247Mode && guild247Settings.autoDisconnect;
                logger.debug('QueueEnd', `Guild ${player.guildId} settings: 24/7 = ${is247Mode}, autoDisconnect = ${guild247Settings.autoDisconnect}`);
            }
            catch (dbError) {
                logger.debug('QueueEnd', 'Could not check guild disconnect settings:', dbError);
            }
            let content = `**All songs in the queue have finished playing.**\n\n`;
            if (is247Mode) {
                content += `├─ **${emoji.get("info") || '♾️'} Mode:** 24/7 Active\n`;
                content += `└─ **${emoji.get("check") || '✅'} Status:** Staying connected to voice channel\n`;
            }
            else if (shouldDisconnect) {
                content += `├─ **${emoji.get("info") || '⏰'} Timeout:** 60 seconds\n`;
                content += `└─ **${emoji.get("cross") || '👋'} Action:** Disconnecting soon to save resources\n`;
            }
            else {
                content += `└─ **${emoji.get("check") || '✅'} Status:** Awaiting new songs\n`;
            }
            const button = new ButtonBuilder()
                .setLabel("Yuna Music")
                .setURL(config.links?.supportServer || "https://discord.gg/XYwwyDKhec")
                .setStyle(ButtonStyle.Link);
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🏁 Queue Complete`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                .addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
                .setButtonAccessory(button));
            const completionMessage = await EventUtils.sendPlayerMessage(client, player, {
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
            if (completionMessage?.id) {
                player.set('queueEndMessageId', completionMessage.id);
            }
            clearStoredMessageIds(player);
            if (shouldDisconnect && !is247Mode) {
                logger.info('QueueEnd', `Autoplay disabled & queue empty - waiting 3min before disconnect for guild ${player.guildId}`);
                const timeoutId = setTimeout(async () => {
                    const currentPlayer = client.music?.getPlayer(player.guildId);
                    if (!currentPlayer || currentPlayer.playing || currentPlayer.queue.current)
                        return;
                    const totalTracks = currentPlayer.get('totalTracksPlayed') || 0;
                    const sessionStartTime = currentPlayer.get('sessionStartTime');
                    let durationString = '';
                    if (sessionStartTime) {
                        // @ts-ignore
                        const minutes = Math.floor((Date.now() - sessionStartTime) / 60000);
                        durationString = ` in ${minutes} minutes`;
                    }
                    const dcContainer = new ContainerBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 👋 Disconnected`))
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                        .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`Queue finished. Disconnected from voice channel.\n\n` +
                        `🎵 **Session Summary:**\n` +
                        `Played **${totalTracks}** tracks${durationString}.`)));
                    await EventUtils.sendPlayerMessage(client, currentPlayer, {
                        components: [dcContainer],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => { });
                    await currentPlayer.destroy();
                }, 180_000);
                player.set('disconnectTimeoutId', timeoutId);
                return;
            }
            else if (is247Mode) {
                logger.info('QueueEnd', `24/7 mode active - keeping connection for guild ${player.guildId}`);
                player.set('247Mode', true);
                EventUtils.clearPlayerTimeout(player, 'disconnectTimeoutId');
            }
            logSessionStats(player);
        }
        catch (error) {
            logger.error('QueueEnd', 'Error in queueEnd event:', error);
            try {
                const fallbackButton = new ButtonBuilder()
                    .setLabel("Support")
                    .setURL("https://discord.gg/XYwwyDKhec")
                    .setStyle(ButtonStyle.Link);
                const fallbackContainer = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🏁 Queue Complete`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                    .addSectionComponents(new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🏁 **Queue finished.** Use a music command to start playing again.`))
                    .setButtonAccessory(fallbackButton));
                await EventUtils.sendPlayerMessage(client, player, {
                    components: [fallbackContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            catch (fallbackError) {
                logger.error('QueueEnd', 'Even fallback queue end message failed:', fallbackError);
            }
        }
    }
};
// @ts-ignore
async function handleAutoplay(player, lastTrack, client) {
    if (!lastTrack?.info) {
        throw new Error('No valid last track for autoplay');
    }
    logger.info('QueueEnd', `Autoplay: Finding next recommendation for "${lastTrack.info.title}" by ${lastTrack.info.author}`);
    if (!autoplayEngine.client) {
        autoplayEngine.client = client;
    }
    const recommendations = await autoplayEngine.getRecommendations(player, lastTrack, 3);
    if (!recommendations?.length) {
        throw new Error(`No similar tracks found for "${lastTrack.info.title}" by ${lastTrack.info.author}`);
    }
    const rec = recommendations[0];
    const pm = new PlayerManager(player);
    let trackInfoToAdd = rec.trackInfo;
    if (!trackInfoToAdd) {
        const query = `${rec.artist} ${rec.name}`;
        const searchResult = await client.music.search(query, { source: "spsearch" });
        if (searchResult?.tracks?.length > 0) {
            trackInfoToAdd = searchResult.tracks[0];
        }
    }
    if (!trackInfoToAdd) {
        throw new Error(`Failed to resolve autoplay track for "${rec.name}" by ${rec.artist}`);
    }
    await pm.addTracks(trackInfoToAdd);
    player.set('autoplayEnabled', true);
    if (!player.playing && !player.paused && player.queue.tracks.length > 0) {
        try {
            await player.play({ noReplace: false });
            logger.info('QueueEnd', `Autoplay: Started playback of next recommended track in guild ${player.guildId}`);
        }
        catch (playError) {
            logger.error('QueueEnd', 'Autoplay: Failed to start playback:', playError);
            try {
                const nextTrack = player.queue.tracks[0];
                if (nextTrack) {
                    await player.play({ clientTrack: nextTrack });
                }
            }
            catch (altPlayError) {
                logger.error('QueueEnd', 'Autoplay: Alternative play also failed:', altPlayError);
            }
        }
    }
    logger.info('QueueEnd', `Autoplay added "${trackInfoToAdd.info.title}" to guild ${player.guildId}`);
}
// @ts-ignore
function isSpotifySource(track) {
    const uri = track.info.uri?.toLowerCase() || '';
    const sourceName = track.info.sourceName?.toLowerCase() || '';
    return uri.includes('spotify.com') ||
        uri.includes('open.spotify.com') ||
        sourceName.includes('spotify') ||
        sourceName.includes('sp');
}
// @ts-ignore
function isYouTubeSource(track) {
    const uri = track.info.uri?.toLowerCase() || '';
    const sourceName = track.info.sourceName?.toLowerCase() || '';
    return uri.includes('youtube.com') ||
        uri.includes('youtu.be') ||
        sourceName.includes('youtube') ||
        sourceName.includes('yt');
}
// @ts-ignore
function getTrackSource(track) {
    const uri = track.info.uri?.toLowerCase() || '';
    const sourceName = track.info.sourceName?.toLowerCase() || '';
    if (uri.includes('spotify.com') || sourceName.includes('spotify')) {
        return 'Spotify';
    }
    else if (uri.includes('youtube.com') || uri.includes('youtu.be') || sourceName.includes('youtube')) {
        return 'YouTube';
    }
    else if (uri.includes('soundcloud.com') || sourceName.includes('soundcloud')) {
        return 'SoundCloud';
    }
    else if (uri.includes('music.apple.com') || sourceName.includes('apple')) {
        return 'Apple Music';
    }
    else if (uri.includes('deezer.com') || sourceName.includes('deezer')) {
        return 'Deezer';
    }
    else if (uri.includes('jiosaavn.com') || sourceName.includes('jiosaavn') || sourceName.includes('saavn')) {
        return 'JioSaavn';
    }
    else if (sourceName) {
        return sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
    }
    else {
        return 'Unknown';
    }
}
// @ts-ignore
function getPremiumStatus(guildId, userId) {
    if (!userId)
        return { hasPremium: false, maxSongs: config.queue.maxSongs.free };
    const premiumStatus = db.hasAnyPremium(userId, guildId);
    return {
        hasPremium: !!premiumStatus,
        type: premiumStatus ? premiumStatus.type : 'free',
        maxSongs: premiumStatus ? config.queue.maxSongs.premium : config.queue.maxSongs.free
    };
}
// @ts-ignore
function clearStoredMessageIds(player) {
    player.set('nowPlayingMessageId', null);
    player.set('nowPlayingChannelId', null);
    player.set('stuckWarningMessageId', null);
    player.set('errorMessageId', null);
    player.set('stuckTimeoutId', null);
}
// @ts-ignore
function logSessionStats(player) {
    try {
        const sessionStats = {
            guildId: player.guildId,
            totalTracksPlayed: player.get('totalTracksPlayed') || 0,
            sessionDuration: Date.now() - (player.get('sessionStartTime') || Date.now()),
            endTime: new Date().toISOString(),
            autoplayEnabled: player.get('autoplayEnabled') || false
        };
        logger.info('QueueEnd', `Session completed in guild ${player.guildId}:`, sessionStats);
    }
    catch (statsError) {
        logger.debug('QueueEnd', 'Error logging session stats:', statsError);
    }
}
