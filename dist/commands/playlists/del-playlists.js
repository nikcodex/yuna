import { Command } from "#core/Command";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
import { db } from "#database/Database";
import { config } from "#config/config";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import phrases from "#utils/phrases";
class DeletePlaylistCommand extends Command {
    constructor() {
        super({
            name: "delete-playlist",
            description: "Delete one of your custom playlists",
            usage: "delete-playlist <playlist_name_or_id>",
            aliases: ["delete-pl", "remove-playlist", "del-playlist"],
            category: "music",
            examples: [
                "delete-playlist My Favorites",
                "delete-pl pl_abc123",
                "remove-playlist Chill Vibes",
            ],
            cooldown: 3,
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: "delete-playlist",
                    description: "Delete one of your custom playlists",
                    options: [
                        {
                            name: "playlist",
                            description: "Playlist name or ID to delete",
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
        let playlistQuery;
        if (interaction) {
            playlistQuery = interaction.options.getString("playlist");
        }
        else {
            if (args.length === 0) {
                const container = this._createUsageContainer();
                return this._reply(context, container);
            }
            playlistQuery = args.join(" ");
        }
        return this._handleDelete(context.user || context.author, playlistQuery, context);
    }
    // @ts-ignore
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleDelete(user, playlistQuery, context) {
        const loadingMessage = await this._reply(context, this._createLoadingContainer(playlistQuery));
        try {
            const userPlaylists = db.playlists.getUserPlaylists(user.id);
            if (userPlaylists.length === 0) {
                return this._editReply(loadingMessage, 
                // @ts-ignore
                this._createNoPlaylistsContainer());
            }
            let targetPlaylist = null;
            if (playlistQuery.startsWith("pl_")) {
                // @ts-ignore
                targetPlaylist = userPlaylists.find((pl) => pl.id === playlistQuery);
            }
            else {
                targetPlaylist = userPlaylists.find(
                // @ts-ignore
                (pl) => pl.name.toLowerCase() === playlistQuery.toLowerCase());
            }
            if (!targetPlaylist) {
                return this._editReply(loadingMessage, 
                // @ts-ignore
                this._createNotFoundContainer(playlistQuery, userPlaylists));
            }
            const success = db.playlists.deletePlaylist(targetPlaylist.id, user.id);
            if (success) {
                return this._editReply(loadingMessage, this._createSuccessContainer(targetPlaylist));
            }
            else {
                throw new Error("Failed to delete playlist");
            }
        }
        catch (error) {
            logger.error("DeletePlaylistCommand", "Error deleting playlist", error);
            let errorMessage = "An error occurred while deleting the playlist. Please try again.";
            if (error.message === "Playlist not found") {
                errorMessage = "The specified playlist could not be found.";
            }
            else if (error.message === "Access denied") {
                errorMessage = "You don't have permission to delete this playlist.";
            }
            return this._editReply(loadingMessage, 
            // @ts-ignore
            this._createErrorContainer(errorMessage));
        }
    }
    _createUsageContainer() {
        const content = `**Missing Playlist Identifier**\n\n` +
            `**${emoji.get("cross")} Status:** Identifier Required\n\n` +
            `Please specify which playlist to delete.\n\n` +
            `**${emoji.get("info")} Usage:**\n` +
            `└─ \`delete-playlist <playlist_name>\`\n` +
            `└─ \`delete-pl <playlist_id>\`\n` +
            `└─ \`remove-playlist <playlist_name>\`\n` +
            `└─ \`del-playlist <playlist_name>\`\n\n` +
            `**${emoji.get("folder")} Examples:**\n` +
            `└─ \`delete-playlist My Favorites\`\n` +
            `└─ \`delete-pl pl_abc12345\`\n` +
            `└─ \`remove-playlist Chill Vibes\`\n\n` +
            `**${emoji.get("info")} Tips:**\n` +
            `└─ Use \`my-playlists\` to see all your playlists\n` +
            `└─ You can use playlist name or ID\n` +
            `└─ Deletion is permanent and cannot be undone\n` +
            `└─ Only you can delete your own playlists`;
        return buildContainer({
            title: "Delete Playlist",
            content: content,
            thumbnail: config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork,
            icon: emoji.get("info") || "ℹ️"
        });
    }
    // @ts-ignore
    _createLoadingContainer(playlistQuery) {
        const content = `**Locating and removing playlist**\n\n` +
            `**${emoji.get("loading")} Status:** Processing\n` +
            `**${emoji.get("folder")} Target:** ${playlistQuery}\n\n` +
            `Please wait while we locate and delete your playlist.\n\n` +
            `*Verifying permissions and removing data...*`;
        return buildContainer({
            title: "Deleting Playlist",
            content: content,
            thumbnail: config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork,
            icon: emoji.get("loading") || "ℹ️"
        });
    }
    _createSuccessContainer(playlist) {
        const playlistId = playlist.id.replace("pl_", "").substring(0, 8);
        const deletedDate = new Date().toLocaleDateString();
        const note = phrases.get("playlistDeleted");
        const content = `**${note}**\n\n` +
            `**${emoji.get("cross")} Name:** ${playlist.name}\n` +
            `**${emoji.get("info")} ID:** ${playlistId}\n` +
            `**${emoji.get("music")} Tracks Lost:** ${playlist.track_count || 0} songs\n` +
            `**${emoji.get("check")} Deleted:** ${deletedDate}\n\n` +
            `**${emoji.get("folder")} Next Steps:**\n` +
            `└─ Use \`create-playlist\` to make new ones\n` +
            `└─ Use \`my-playlists\` to see remaining playlists`;
        return buildSuccess(content, "Playlist Deleted Successfully");
    }
    _createErrorContainer(message) {
        return buildError(message, "Deletion Failed");
    }
    // @ts-ignore
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true,
        };
        if (context.replied || context.deferred) {
            return context.editReply(payload);
        }
        else if (typeof context.reply === "function") {
            return (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
        }
        else if (context.channel) {
            return context.channel.send(payload);
        }
    }
    // @ts-ignore
    async _editReply(message, container) {
        if (!message)
            return null;
        return message.edit({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}
export default new DeletePlaylistCommand();
