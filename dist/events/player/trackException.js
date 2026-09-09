import { logger } from "#utils/logger";
import { EventUtils } from "#utils/EventUtils";
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, ButtonBuilder, ButtonStyle, SectionBuilder } from "discord.js";
export default {
    name: "trackException",
    once: false,
    async execute(player, track, payload, musicManager, client) {
        try {
            logger.error('TrackException', `Lavalink encountered an error playing track in guild ${player.guildId}:`, {
                track: track?.info?.title || 'Unknown',
                exception: payload?.exception || payload,
                guildId: player.guildId
            });
            const errorMsg = payload?.exception?.message || payload?.error || 'Unknown Lavalink error';
            const title = track?.info?.title;
            const author = track?.info?.author;
            // Automatic Fallback System: If YouTube breaks, search SoundCloud for an alternative stream!
            if (title && client?.music) {
                try {
                    const query = `scsearch:${author ? `${author} ` : ''}${title}`;
                    logger.info('TrackException', `Attempting SoundCloud fallback for "${query}" in guild ${player.guildId}`);
                    const fallbackRes = await client.music.search(query);
                    if (fallbackRes?.tracks?.length > 0) {
                        const fallbackTrack = fallbackRes.tracks[0];
                        logger.info('TrackException', `Found SoundCloud fallback stream: "${fallbackTrack.info.title}"`);
                        // Queue and play fallback track
                        await player.play({ clientTrack: fallbackTrack });
                        const fallbackNotice = new ContainerBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🔄 **Stream Recovery Active**`))
                            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                            .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`YouTube stream was blocked by YouTube bot protection.\n\n` +
                            `├─ 🎵 **Original Track:** ${title}\n` +
                            `└─ ⚡ **Auto-Fallback:** Switched to SoundCloud stream automatically!`)));
                        return await EventUtils.sendPlayerMessage(client, player, {
                            components: [fallbackNotice],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }
                }
                catch (fallbackErr) {
                    logger.error('TrackException', 'Fallback resolution failed:', fallbackErr);
                }
            }
            const button = new ButtonBuilder()
                .setLabel("Support")
                .setURL("https://discord.gg/XYwwyDKhec")
                .setStyle(ButtonStyle.Link);
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ⚠️ Playback Error`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                .addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Lavalink failed to play: **${track?.info?.title || 'Unknown'}**\n\n**Reason:** ${errorMsg}`))
                .setButtonAccessory(button));
            await EventUtils.sendPlayerMessage(client, player, {
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
        catch (error) {
            logger.error('TrackException', 'Error in trackException event handler:', error);
        }
    }
};
