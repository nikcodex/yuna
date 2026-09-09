import { AttachmentBuilder, MessageFlags } from 'discord.js';
import { Command } from '#core/Command';
import MusicCard from '#ui/cards/MusicCard';
import { db } from '#database/Database';
import { logger } from '#utils/logger';
import { buildError } from '#ui/Theme';
import phrases from '#utils/phrases';
class NowPlayingCommand extends Command {
    constructor() {
        super({
            name: 'nowplaying',
            description: 'Displays the currently playing song with a beautiful custom-designed visual card',
            usage: 'nowplaying',
            aliases: ['np'],
            category: 'music',
            examples: [
                'nowplaying',
                'np',
            ],
            cooldown: 5,
            access: {
                player: true,
                playing: true,
            },
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: 'nowplaying',
                    description: 'Displays the currently playing song with a visual card',
                },
            },
        });
        // @ts-ignore
        this.musicCard = new MusicCard();
    }
    async execute(ctx) {
        const { client, message, interaction, player, pm, args = [] } = ctx;
        const context = interaction || message;
        return this._handleNowPlaying(client, context.guild.id, context);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleNowPlaying(client, guildId, context) {
        const player = client.music?.getPlayer(guildId);
        if (!player || !player.queue.current) {
            return this._replyError(context, phrases.get("noTrackPlaying"));
        }
        try {
            const track = player.queue.current;
            // @ts-ignore
            const userId = context.user?.id || context.author?.id;
            // @ts-ignore
            const isPremium = userId ? !!db.hasAnyPremium(userId, context.guild?.id) : false;
            const style = userId ? db.getNpStyle(userId) : 'card';
            const isTextMode = style === 'text';
            if (isTextMode) {
                const { createPlayerContainer } = await import('#ui/Components');
                const container = createPlayerContainer('default', {
                    isTextMode: true,
                    track,
                    position: player.position
                });
                return await this._reply(context, { components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            // @ts-ignore
            const buffer = await this.musicCard.createMusicCard(track, player.position, { isPremium });
            const attachment = new AttachmentBuilder(buffer, { name: 'yuna-nowplaying.png' });
            await this._reply(context, { files: [attachment] });
        }
        catch (error) {
            // @ts-ignore
            logger.error('NowPlayingCommand', `Failed to create or send canvas: ${error.message}`, error);
            return this._replyError(context, 'An error occurred while creating the Now Playing card.');
        }
    }
    async _reply(context, payload) {
        try {
            // @ts-ignore
            if (context.editReply && (context.deferred || context.replied)) {
                // @ts-ignore
                return await context.editReply(payload);
            }
            // @ts-ignore
            return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
        }
        catch (error) {
            logger.error('NowPlayingCommand', 'Failed to send reply in NowPlaying command:', error);
        }
    }
    // @ts-ignore
    async _replyError(context, message) {
        const container = buildError(message);
        const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
        // @ts-ignore
        if (context.editReply && (context.deferred || context.replied)) {
            // @ts-ignore
            return await context.editReply(payload);
        }
        // @ts-ignore
        return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
    }
}
export default new NowPlayingCommand();
