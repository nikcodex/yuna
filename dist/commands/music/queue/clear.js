import { MessageFlags } from "discord.js";
import { config } from "#config/config";
import { Command } from '#core/Command';
import { buildContainer, buildError } from '#ui/Theme';
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import phrases from "#utils/phrases";
import { PlayerManager } from '#audio/PlayerManager';
class ClearCommand extends Command {
    constructor() {
        super({
            name: "clear",
            description: "Clear all upcoming tracks from the queue",
            usage: "clear",
            aliases: ["cq", "clearqueue"],
            category: "music",
            examples: ["clear", "cq"],
            cooldown: 3,
            access: {
                voice: true,
                sameVoice: true,
                player: true,
            },
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: "clear",
                    description: "Clear all upcoming tracks from the queue",
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
        return this._handleclear(context, activePm);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleclear(context, pm) {
        if (pm.queueSize === 0) {
            return this._reply(context, this._createErrorContainer(phrases.get("noTrackPlaying")));
        }
        const size = pm.queueSize;
        await pm.clearQueue();
        const container = this._createSuccessContainer(pm, size);
        return await this._reply(context, container);
    }
    // @ts-ignore
    _createSuccessContainer(pm, size) {
        const content = `Cleared **${size}** tracks from the queue.`;
        const current = pm.player?.queue?.current;
        return buildContainer({ image: undefined,
            title: "Queue Cleared",
            content: content,
            thumbnail: current?.info?.artworkUrl || config.assets.defaultTrackArtwork,
            icon: emoji.get("music") || "🎵"
        });
    }
    _createErrorContainer(message) {
        return buildError(message);
    }
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true,
        };
        try {
            if (context.editReply && (context.deferred || context.replied)) {
                return await context.editReply(payload);
            }
            return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
        }
        catch (e) {
            logger.error("clear", "Failed to reply in clear command:", e);
            return null;
        }
    }
}
export default new ClearCommand();
