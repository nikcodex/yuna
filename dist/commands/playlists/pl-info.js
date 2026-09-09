import { Command } from "#core/Command";
import { ButtonStyle, MessageFlags, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder } from "discord.js";
import { buildContainer, buildError } from "#ui/Theme";
import { db } from "#database/Database";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
const TRACKS_PER_PAGE = 10;
class PlaylistInfoCommand extends Command {
    constructor() {
        super({
            name: "playlist-info",
            description: "View detailed information and manage a custom playlist",
            usage: "playlist-info [playlist_id_or_name]",
            aliases: ["pl-info", "p-info"],
            category: "music",
            examples: [
                "playlist-info",
                "playlist-info My Favorites",
                "pl-info pl_abc123",
            ],
            cooldown: 3,
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: "playlist-info",
                    description: "View detailed info for a playlist",
                    options: [
                        {
                            name: "playlist",
                            description: "The ID or name of the playlist to view",
                            type: 3,
                            required: false,
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
        const query = interaction ? (interaction.options.getString("playlist") || null) : (args.join(" ") || null);
        return this._handleInfo(client, context, context.user || context.author, query);
    }
    // @ts-ignore
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleInfo(client, context, user, query) {
        const userId = user.id;
        if (query) {
            const playlist = this._findPlaylist(userId, query);
            if (!playlist) {
                return this._reply(context, 
                // @ts-ignore
                this._createNotFoundContainer(query, userId));
            }
            const message = await this._reply(context, this._createMainInfoContainer(playlist));
            if (message)
                this._setupCollector(message, userId, playlist);
        }
        else {
            const playlists = db.playlists.getUserPlaylists(userId);
            if (playlists.length === 0) {
                // @ts-ignore
                return this._reply(context, this._createNoPlaylistsContainer());
            }
            const message = await this._reply(context, this._createSelectionContainer(playlists));
            if (message)
                this._setupCollector(message, userId, null, playlists);
        }
    }
    // @ts-ignore
    _findPlaylist(userId, query) {
        const userPlaylists = db.playlists.getUserPlaylists(userId);
        const trimmedQuery = query.trim();
        if (trimmedQuery.startsWith("pl_")) {
            // @ts-ignore
            return userPlaylists.find((p) => p.id === trimmedQuery);
        }
        if (trimmedQuery.length <= 16 && !trimmedQuery.includes(" ")) {
            // @ts-ignore
            const playlistById = userPlaylists.find((p) => p.id.includes(trimmedQuery));
            if (playlistById)
                return playlistById;
        }
        return userPlaylists.find(
        // @ts-ignore
        (p) => p.name.toLowerCase() === trimmedQuery.toLowerCase());
    }
    // @ts-ignore
    _createSelectionContainer(playlists) {
        const content = `**Select a playlist**\n\n` +
            `You have **${playlists.length}** playlists. Choose one from the menu below to view its details and manage its tracks.`;
        const selectMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId("plinfo_select")
            .setPlaceholder("Select a playlist...")
            .addOptions(
        // @ts-ignore
        playlists.slice(0, 25).map((pl) => ({
            label: pl.name,
            description: `${pl.track_count} tracks`,
            value: pl.id,
            emoji: "📁",
        }))));
        return buildContainer({
            title: "Your Playlists",
            content: content,
            thumbnail: null,
            components: [selectMenu],
            icon: emoji.get("folder") || "ℹ️"
        });
    }
    _createMainInfoContainer(playlist) {
        const shortId = playlist.id.replace("pl_", "").substring(0, 8);
        const descriptionText = playlist.description
            ? `**${emoji.get("info")} Description:** ${playlist.description}\n`
            : "";
        const content = `**Overview of your playlist**\n\n` +
            `**${emoji.get("folder")} Name:** ${playlist.name}\n` +
            `${descriptionText}` +
            `**${emoji.get("info")} ID:** ${shortId}\n` +
            `**${emoji.get("music")} Tracks:** ${playlist.track_count} songs\n` +
            `**${emoji.get("reset")} Duration:** ${this._formatDuration(playlist.total_duration)}\n` +
            `**${emoji.get("check")} Created:** ${new Date(playlist.created_at).toLocaleString()}\n` +
            `**${emoji.get("add")} Updated:** ${new Date(playlist.updated_at).toLocaleString()}`;
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId("plinfo_view_tracks")
            .setLabel(`View Tracks (${playlist.track_count})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emoji.get("music") || "🎵")
            .setDisabled(playlist.track_count === 0));
        return buildContainer({
            title: `Playlist Details: ${playlist.name}`,
            content: content,
            thumbnail: null,
            components: [buttons],
            icon: emoji.get("openfolder") || "ℹ️"
        });
    }
    // @ts-ignore
    _createTracksContainer(playlist, page) {
        const totalPages = Math.ceil(playlist.tracks.length / TRACKS_PER_PAGE) || 1;
        page = Math.max(1, Math.min(page, totalPages));
        const startIdx = (page - 1) * TRACKS_PER_PAGE;
        const pageTracks = playlist.tracks.slice(startIdx, startIdx + TRACKS_PER_PAGE);
        let trackListStr = `Viewing tracks for playlist **${playlist.name}** (Page ${page}/${totalPages}).\n\n`;
        // @ts-ignore
        pageTracks.forEach((track, index) => {
            const globalIdx = startIdx + index + 1;
            trackListStr += `**${globalIdx}.** ${track.title} - *${track.author}* (${this._formatDuration(track.duration)})\n`;
        });
        const components = [];
        if (pageTracks.length > 0) {
            const selectMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
                .setCustomId("plinfo_remove_tracks")
                .setPlaceholder("Select tracks to remove...")
                .setMinValues(1)
                .setMaxValues(pageTracks.length)
                .addOptions(
            // @ts-ignore
            pageTracks.map((track, index) => ({
                label: `${startIdx + index + 1}. ${track.title}`.substring(0, 100),
                description: track.author ? track.author.substring(0, 100) : "Unknown",
                value: track.identifier,
            }))));
            components.push(selectMenu);
        }
        const navButtons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId("plinfo_back_to_info")
            .setLabel("Back to Overview")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emoji.get("left") || "⬅️"), new ButtonBuilder()
            .setCustomId("plinfo_tracks_prev")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1), new ButtonBuilder()
            .setCustomId("plinfo_tracks_next")
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages));
        components.push(navButtons);
        return buildContainer({
            title: `Tracks in: ${playlist.name}`,
            content: trackListStr,
            thumbnail: null,
            components: components,
            icon: emoji.get("music") || "ℹ️"
        });
    }
    // @ts-ignore
    _setupCollector(message, userId, initialPlaylist, allPlaylists = null) {
        // @ts-ignore
        const filter = (i) => i.user.id === userId;
        const collector = message.createMessageComponentCollector({
            filter,
            time: 300000,
        });
        let currentPlaylist = initialPlaylist;
        let currentPage = 1;
        // @ts-ignore
        collector.on("collect", async (interaction) => {
            await interaction.deferUpdate();
            const [action, ...params] = interaction.customId.split("_");
            if (action !== "plinfo")
                return;
            const subAction = params[0];
            switch (subAction) {
                case "select": {
                    const playlistId = interaction.values[0];
                    // @ts-ignore
                    currentPlaylist = allPlaylists.find((p) => p.id === playlistId);
                    if (currentPlaylist) {
                        await interaction.editReply({
                            components: [this._createMainInfoContainer(currentPlaylist)],
                        });
                    }
                    break;
                }
                case "view": {
                    currentPage = 1;
                    await interaction.editReply({
                        components: [this._createTracksContainer(currentPlaylist, currentPage)],
                    });
                    break;
                }
                case "back": {
                    await interaction.editReply({
                        components: [this._createMainInfoContainer(currentPlaylist)],
                    });
                    break;
                }
                case "tracks": {
                    const direction = params[1];
                    currentPage =
                        direction === "prev" ? currentPage - 1 : currentPage + 1;
                    await interaction.editReply({
                        components: [this._createTracksContainer(currentPlaylist, currentPage)],
                    });
                    break;
                }
                case "remove": {
                    const identifiersToRemove = interaction.values;
                    let removedCount = 0;
                    for (const id of identifiersToRemove) {
                        try {
                            await db.playlists.removeTrackFromPlaylist(currentPlaylist.id, userId, id);
                            removedCount++;
                        }
                        catch (e) {
                            logger.error("PlaylistInfo", `Failed to remove track ${id} from ${currentPlaylist.id}`, e);
                        }
                    }
                    currentPlaylist = db.playlists.getPlaylist(currentPlaylist.id);
                    const totalPages = Math.ceil(currentPlaylist.tracks.length / TRACKS_PER_PAGE) || 1;
                    if (currentPage > totalPages)
                        currentPage = totalPages;
                    await interaction.editReply({
                        components: [this._createTracksContainer(currentPlaylist, currentPage)],
                    });
                    await interaction.followUp({
                        content: `Successfully removed ${removedCount} track(s).`,
                        ephemeral: true,
                    });
                    break;
                }
            }
        });
        collector.on("end", async () => {
            try {
                await message.edit({
                    components: [this._createExpiredContainer()],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
            catch (error) {
                if (error.code !== 10008) {
                    logger.error("PlaylistInfo", "Failed to edit message on collector end", error);
                }
            }
        });
    }
    _formatDuration(ms) {
        if (!ms || ms < 0)
            return "0:00";
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    // @ts-ignore
    _createNotFoundContainer(query) {
        return buildError(`Could not find a playlist matching \`${query}\`.\n\n` +
            `**Tips:**\n` +
            `└─ Check the spelling of the playlist name.\n` +
            `└─ Try using the playlist's ID.\n` +
            `└─ Use \`/my-playlists\` to see a list of your playlists.`, "Playlist Not Found");
    }
    _createExpiredContainer() {
        const content = `This interactive menu has expired.\nPlease run the command again.`;
        return buildContainer({
            title: "Interaction Expired",
            content: content,
            thumbnail: null,
            icon: emoji.get("info") || "ℹ️"
        });
    }
    // @ts-ignore
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true,
        };
        try {
            if (context.replied || context.deferred) {
                return context.editReply(payload);
            }
            return (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
        }
        catch (error) {
            logger.error("PlaylistInfoCommand", "Error in _reply", error);
            return null;
        }
    }
}
export default new PlaylistInfoCommand();
