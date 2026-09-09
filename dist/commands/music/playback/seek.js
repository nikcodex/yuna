import { Command } from '#core/Command';
import { buildContainer, buildError } from '#ui/Theme';
import { MessageFlags } from "discord.js";
import { config } from "#config/config";
import emoji from "#config/emoji";
import phrases from "#utils/phrases";
import { PlayerManager } from '#audio/PlayerManager';
class SeekCommand extends Command {
    constructor() {
        super({
            name: "seek",
            description: "Seek to a specific time in the current track using various time formats",
            usage: "seek <time>",
            aliases: ["sk"],
            category: "music",
            examples: ["seek 2:30", "seek 1min 30s", "sk 90s", "seek 0:45"],
            cooldown: 5,
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
                    name: "seek",
                    description: "Seek to a specific time in the current track",
                    options: [
                        {
                            name: "time",
                            description: "Time to seek to (e.g., 2:30, 1min 30s, 90s)",
                            type: 3,
                            required: true,
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
        const timeString = interaction ? interaction.options.getString("time") : args.join(" ");
        if (!timeString || !timeString.trim()) {
            return this._reply(context, this._createErrorContainer(ctx.t("seekInvalid")));
        }
        return this._handleSeek(context, activePm, timeString.trim());
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    async _handleSeek(context, pm, timeString) {
        const track = pm.currentTrack;
        if (!track.info.isSeekable) {
            return this._reply(context, this._createErrorContainer(phrases.get("seekInvalid")));
        }
        const timeMs = this._parseTime(timeString);
        if (timeMs === null) {
            return this._reply(context, this._createErrorContainer(phrases.get("seekInvalid")));
        }
        if (timeMs > track.info.duration) {
            return this._reply(context, this._createErrorContainer(phrases.get("seekInvalid")));
        }
        await pm.seek(timeMs);
        const content = `**Track Seeked**\n\n` +
            `└─ **${emoji.get("music") || "🎵"} Title:** ${track.info.title}\n` +
            `└─ **${emoji.get("time") || "⏰"} To:** ${this._formatDuration(timeMs / 1000)}\n` +
            `└─ **${emoji.get("info") || "ℹ️"} Duration:** ${this._formatDuration(track.info.duration / 1000)}`;
        const container = buildContainer({
            title: "Track Seeked",
            content: content,
            thumbnail: track.info.artworkUrl || config.assets.defaultTrackArtwork,
            icon: emoji.get("music") || "ℹ️"
        });
        return this._reply(context, container);
    }
    _parseTime(timeString) {
        try {
            if (timeString.includes(":")) {
                const parts = timeString.split(":").map(Number);
                if (parts.some(isNaN))
                    return null;
                if (parts.length === 2) {
                    return (parts[0] * 60 + parts[1]) * 1000;
                }
                else if (parts.length === 3) {
                    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
                }
            }
            let totalMs = 0;
            const timeRegex = /(\d+)\s*(h|hr|hour|hours|m|min|minute|minutes|s|sec|second|seconds)/gi;
            let match;
            let hasMatch = false;
            while ((match = timeRegex.exec(timeString)) !== null) {
                hasMatch = true;
                const value = parseInt(match[1], 10);
                const unit = match[2].toLowerCase();
                if (unit.startsWith("h")) {
                    totalMs += value * 3600000;
                }
                else if (unit.startsWith("m")) {
                    totalMs += value * 60000;
                }
                else if (unit.startsWith("s")) {
                    totalMs += value * 1000;
                }
            }
            if (hasMatch) {
                return totalMs;
            }
            const seconds = parseInt(timeString, 10);
            if (!isNaN(seconds)) {
                return seconds * 1000;
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    _formatDuration(durationInSeconds) {
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        const seconds = Math.floor(durationInSeconds % 60);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
export default new SeekCommand();
