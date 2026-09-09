import { MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, ThumbnailBuilder, } from "discord.js";
import { config } from '#config/config';
import { Command } from '#core/Command';
import { buildContainer, buildError } from '#ui/Theme';
import emoji from '#config/emoji';
import phrases from '#utils/phrases';
import { PlayerManager } from '#audio/PlayerManager';
class ReplayCommand extends Command {
    constructor() {
        super({
            name: 'replay',
            description: 'Replay the current track from the beginning (not available for live streams)',
            usage: 'replay',
            aliases: ['restart'],
            category: 'music',
            examples: [
                'replay',
                'restart',
            ],
            cooldown: 3,
            access: {
                voice: true,
                sameVoice: true,
                player: true,
                playing: true,
            },
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: 'replay',
                    description: 'Replay the current track from the beginning',
                },
            },
        });
    }
    async execute(ctx) {
        const { client, message, interaction, player, pm, args = [] } = ctx;
        const context = interaction || message;
        const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
        if (!activePm)
            return;
        return this._handleReplay(context, activePm);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    async _handleReplay(context, pm) {
        const { currentTrack } = pm;
        if (currentTrack.info.isStream) {
            return this._reply(context, this._createErrorContainer(phrases.get('seekInvalid')));
        }
        try {
            await pm.replay();
        }
        catch (err) {
            return this._reply(context, this._createErrorContainer(`Failed to replay: ${err.message}`));
        }
        const replayNote = phrases.get('replaySuccess');
        const content = `**Track Information**\n\n` +
            `└─ **${emoji.get('music')} Title:** ${currentTrack.info.title}\n` +
            `└─ **${emoji.get('folder')} Artist:** ${currentTrack.info.author || 'Unknown'}\n` +
            `└─ **${emoji.get('info')} Duration:** ${this._formatDuration(currentTrack.info.duration)}\n` +
            `└─ **${emoji.get('check')} Status:** Playback restarted\n\n` +
            `*${replayNote}*`;
        const container = buildContainer({
            title: "Track Replayed",
            content: content,
            thumbnail: currentTrack.info.artworkUrl || config.assets.defaultTrackArtwork,
            icon: emoji.get("music") || "ℹ️"
        });
        if (currentTrack.requester?.id) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            const requesterContent = `**Request Information**\n\n` +
                `└─ **${emoji.get('add')} Requested by:** <@${currentTrack.requester.id}>\n` +
                `└─ **${emoji.get('reset')} Action:** Track replayed\n` +
                `└─ **${emoji.get('check')} Status:** Now playing from start\n\n` +
                `*Original request information preserved*`;
            container.addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(requesterContent))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork)));
        }
        return this._reply(context, container);
    }
    _formatDuration(duration) {
        if (!duration || duration < 0)
            return 'Live';
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    // @ts-ignore
    _createErrorContainer(message) {
        return buildError(message);
    }
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
        // @ts-ignore
        if (context.editReply && (context.deferred || context.replied)) {
            // @ts-ignore
            return await context.editReply(payload);
        }
        // @ts-ignore
        return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
    }
}
export default new ReplayCommand();
