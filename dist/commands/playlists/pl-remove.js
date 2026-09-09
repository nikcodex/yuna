import { Command } from "#core/Command";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
import { db } from "#database/Database";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import phrases from "#utils/phrases";
class RemoveTrackCommand extends Command {
    constructor() {
        super({
            name: "remove-track",
            description: "Remove tracks from a playlist by position or range",
            usage: "remove-track <playlist_name_or_id> <positions>",
            aliases: ["rm-track", "pl-remove"],
            category: "music",
            examples: [
                "remove-track MyFavorites 5",
                "rm-track MyFavorites: 3, 7, 10",
                "pl-remove MyFavorites 5-10",
            ],
            cooldown: 3,
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: "remove-track",
                    description: "Remove tracks from a playlist",
                    options: [
                        {
                            name: "playlist",
                            description: "The ID or name of the playlist",
                            type: 3,
                            required: true,
                        },
                        {
                            name: "positions",
                            description: "Track numbers or ranges to remove (e.g., 5, 8-10)",
                            type: 3,
                            required: true,
                        },
                    ],
                },
            },
        });
    }
    // @ts-ignore
    async execute(ctx) {
        const { client, message, interaction, player, pm, args = [] } = ctx;
        const context = interaction || message;
        let query, positions;
        if (interaction) {
            query = interaction.options.getString("playlist");
            positions = interaction.options.getString("positions");
        }
        else {
            if (args.length < 2) {
                const container = this._createUsageContainer();
                return this._reply(context, container);
            }
            positions = args.pop();
            query = args.join(" ");
        }
        return this._handleRemove(context.user || context.author, context, query, positions);
    }
    // @ts-ignore
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleRemove(user, context, query, positionsStr) {
        const playlist = this._findPlaylist(user.id, query);
        if (!playlist)
            return this._reply(context, this._createErrorContainer(
            // @ts-ignore
            `Playlist not found for query\`${query}\``));
        if (playlist.tracks.length === 0)
            return this._reply(context, 
            // @ts-ignore
            this._createErrorContainer("This playlist is empty."));
        const indicesToRemove = this._parseTrackIndices(positionsStr, playlist.tracks.length);
        if (indicesToRemove.length === 0) {
            return this._reply(context, this._createErrorContainer(
            // @ts-ignore
            "Invalid or out-of-range track numbers provided."));
        }
        const removedTracks = [];
        let successCount = 0;
        let failCount = 0;
        // @ts-ignore
        indicesToRemove.sort((a, b) => b - a);
        for (const index of indicesToRemove) {
            const track = playlist.tracks[index];
            if (track) {
                try {
                    await db.playlists.removeTrackFromPlaylist(playlist.id, user.id, track.identifier);
                    // @ts-ignore
                    removedTracks.push(`**${index + 1}.** ${track.title}`);
                    successCount++;
                }
                catch (error) {
                    logger.error("RemoveTrack", `Failed to remove track at index ${index}`, error);
                    failCount++;
                }
            }
        }
        const finalPlaylist = db.playlists.getPlaylist(playlist.id);
        return this._reply(context, this._createSuccessContainer(finalPlaylist, removedTracks, successCount, failCount));
    }
    // @ts-ignore
    _parseTrackIndices(str, max) {
        const indices = new Set();
        const parts = str.split(",");
        for (const part of parts) {
            if (part.includes("-")) {
                const [start, end] = part.split("-").map(Number);
                if (!isNaN(start) &&
                    !isNaN(end) &&
                    start <= end &&
                    start > 0 &&
                    end <= max) {
                    for (let i = start; i <= end; i++) {
                        indices.add(i - 1);
                    }
                }
            }
            else {
                const num = Number(part);
                if (!isNaN(num) && num > 0 && num <= max) {
                    indices.add(num - 1);
                }
            }
        }
        return Array.from(indices);
    }
    // @ts-ignore
    _findPlaylist(userId, query) {
        const userPlaylists = db.playlists.getUserPlaylists(userId);
        const trimmedQuery = query.trim();
        if (trimmedQuery.startsWith("pl_"))
            // @ts-ignore
            return userPlaylists.find((p) => p.id === trimmedQuery);
        if (trimmedQuery.length <= 16 && !trimmedQuery.includes(" ")) {
            // @ts-ignore
            const byId = userPlaylists.find((p) => p.id.includes(trimmedQuery));
            if (byId)
                return byId;
        }
        return userPlaylists.find(
        // @ts-ignore
        (p) => p.name.toLowerCase() === trimmedQuery.toLowerCase());
    }
    // @ts-ignore
    _createSuccessContainer(playlist, removedTracks, success, failed) {
        const note = phrases.get("playlistUpdated");
        const content = `Successfully removed **${success}** track(s) from **${playlist.name}**.\n\n*${note}*`;
        return buildSuccess(content, "Tracks Removed");
    }
    _createErrorContainer(message) {
        return buildError(message, "Error");
    }
    _createUsageContainer() {
        const content = `**Usage:** \`remove-track <playlist_name_or_id> <positions>\`\n\n` +
            `Remove specific tracks or ranges from a playlist.\n\n` +
            `**Examples:**\n` +
            `└─ \`remove-track MyFavorites 5\` (removes track 5)\n` +
            `└─ \`remove-track MyFavorites: 3,7,10\` (removes: 3, 7, 10)\n` +
            `└─ \`remove-track MyFavorites 5-10\` (removes 5 through 10)`;
        return buildContainer({
            title: "Remove Track Command",
            content,
            icon: emoji.get("info") || "ℹ️"
        });
    }
    // @ts-ignore
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
        if (context.replied || context.deferred)
            return context.editReply(payload);
        return (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
    }
}
export default new RemoveTrackCommand();
