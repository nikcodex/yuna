import { MessageFlags } from "discord.js";
import { config } from "#config/config";
import { Command } from '#core/Command';
import { buildContainer, buildError } from '#ui/Theme';
import emoji from "#config/emoji";
import phrases from "#utils/phrases";
import { PlayerManager } from '#audio/PlayerManager';
class RewindCommand extends Command {
    constructor() {
        super({
            name: "rewind",
            description: "Rewind the current track by specified seconds (default: 10 seconds, not available for live streams)",
            usage: "rewind [seconds]",
            aliases: ["rw", "back10"],
            category: "music",
            examples: ["rewind", "rewind 30", "rw 15", "back10"],
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
                    name: "rewind",
                    description: "Rewind the current track by specified seconds",
                    options: [
                        {
                            name: "seconds",
                            description: "Number of seconds to rewind (default: 10)",
                            type: 4,
                            required: false,
                            min_value: 1,
                            max_value: 300,
                        },
                    ],
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
        const seconds = interaction ? interaction.options.getInteger("seconds") : (args[0] ? parseInt(args[0], 10) : null);
        return this._handleRewind(context, activePm, 
        // @ts-ignore
        seconds ? [seconds.toString()] : []);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    async _handleRewind(context, pm, args = []) {
        const { currentTrack } = pm;
        if (currentTrack.info.isStream) {
            return this._reply(context, this._createErrorContainer(phrases.get("seekInvalid")));
        }
        let seconds = 10;
        if (args[0]) {
            const parsedSeconds = parseInt(args[0]);
            if (isNaN(parsedSeconds) || parsedSeconds < 1 || parsedSeconds > 300) {
                return this._reply(context, this._createErrorContainer(phrases.get("seekInvalid")));
            }
            seconds = parsedSeconds;
        }
        let newPosition;
        try {
            newPosition = await pm.rewind(seconds * 1000);
        }
        catch (err) {
            return this._reply(context, this._createErrorContainer(`Failed to rewind: ${err.message}`));
        }
        const content = `**Track Rewound**\n\n` +
            `└─ **${emoji.get("music") || "🎵"} Title:** ${currentTrack.info.title}\n` +
            `└─ **${emoji.get("time") || "⏰"} Rewound by:** ${seconds} seconds\n` +
            `└─ **${emoji.get("info") || "ℹ️"} New Position:** ${this._formatDuration(newPosition / 1000)} / ${this._formatDuration(currentTrack.info.duration / 1000)}`;
        const container = buildContainer({
            title: "Track Rewound",
            content: content,
            thumbnail: currentTrack.info.artworkUrl || config.assets.defaultTrackArtwork,
            icon: emoji.get("music") || "ℹ️"
        });
        return this._reply(context, container);
    }
    _formatDuration(durationInSeconds) {
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        const seconds = Math.floor(durationInSeconds % 60);
        if (hours > 0) {
            return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        }
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
export default new RewindCommand();
