import { Command } from '#core/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from "discord.js";
import { config } from "#config/config";
import emoji from "#config/emoji";
import { logger } from "#utils/logger";
import { buildContainer, buildError } from '#ui/Theme';
import phrases from "#utils/phrases";
import { Client as LrcClient } from "lrclib-api";
// @ts-ignore
const lrclib = new LrcClient({ userAgent: "Yuna/2.0.0 (https://github.com/nikhil/yuna)" });
const COLORS = {
    LYRICS_LIVE: parseInt((config.colors?.success || '#2ecc71').replace('#', ''), 16),
    LYRICS_STATIC: parseInt((config.colors?.info || '#3498db').replace('#', ''), 16),
    LOADING: parseInt((config.colors?.theme || '#5865F2').replace('#', ''), 16),
    ERROR: parseInt((config.colors?.error || '#e74c3c').replace('#', ''), 16),
};
class LyricsCommand extends Command {
    constructor() {
        super({
            name: "lyrics",
            description: "Get synchronized lyrics for the currently playing song with live timing",
            usage: "lyrics [song name]",
            aliases: ["ly", "lyric"],
            category: "music",
            examples: ["lyrics", "lyrics Never Gonna Give You Up"],
            cooldown: 5,
            access: {
                voice: false,
            },
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: "lyrics",
                    description: "Get synchronized lyrics for the currently playing song",
                    options: [
                        {
                            name: "query",
                            description: "Search lyrics by song name (optional — uses current song if empty)",
                            type: 3,
                            required: false,
                        },
                    ],
                },
            },
        });
    }
    async execute(ctx) {
        const { client, message, interaction, player, pm, args = [] } = ctx;
        const context = interaction || message;
        try {
            const activePlayer = player || client.music?.getPlayer(context.guildId || context.guild?.id);
            const manualQuery = interaction ? (interaction.options.getString("query") || null) : (args.length > 0 ? args.join(" ") : null);
            if (!activePlayer?.queue?.current && !manualQuery) {
                const errorContainer = this._createErrorContainer("No song is currently playing. Use `/lyrics query:song name` or `.lyrics <song name>` to search manually.");
                const payload = { components: [errorContainer], flags: MessageFlags.IsComponentsV2 };
                if (context.editReply && (context.deferred || context.replied)) {
                    return await context.editReply(payload);
                }
                return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
            }
            let loadingMsg;
            const loadPayload = {
                components: [this._createLoadingContainer()],
                flags: MessageFlags.IsComponentsV2,
            };
            if (interaction) {
                loadingMsg = await interaction.editReply(loadPayload);
            }
            else {
                loadingMsg = await message.reply(loadPayload);
            }
            const track = activePlayer?.queue?.current || null;
            const { trackName, artistName } = this._extractTrackInfo(track, manualQuery);
            const lyricsData = await this._fetchLyrics(trackName, artistName, track?.info?.duration, manualQuery ? null : track?.encoded);
            if (!lyricsData) {
                const notFoundPayload = {
                    components: [this._createNotFoundContainer(trackName, artistName)],
                    flags: MessageFlags.IsComponentsV2,
                };
                if (interaction) {
                    return await interaction.editReply(notFoundPayload);
                }
                return await loadingMsg.edit(notFoundPayload);
            }
            await this._handleLyricsDisplay(loadingMsg, lyricsData, track, activePlayer, client, context.guild.id, (context.user || context.author).id, !!interaction);
        }
        catch (error) {
            // @ts-ignore
            logger.error("LyricsCommand", `Error in lyrics command: ${error.message}`, error);
            const errorContainer = this._createErrorContainer("An error occurred while fetching lyrics.");
            const payload = { components: [errorContainer], flags: MessageFlags.IsComponentsV2 };
            if (context.editReply && (context.deferred || context.replied)) {
                await context.editReply(payload).catch(() => { });
            }
            else if (context.reply) {
                await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload).catch(() => { });
            }
        }
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    _extractTrackInfo(track, manualQuery) {
        if (manualQuery) {
            const dashSplit = manualQuery.match(/^(.+?)\s*[-–—]\s*(.+)$/);
            if (dashSplit) {
                return { trackName: dashSplit[2].trim(), artistName: dashSplit[1].trim() };
            }
            return { trackName: manualQuery.trim(), artistName: "" };
        }
        if (!track?.info)
            return { trackName: "", artistName: "" };
        let title = track.info.title || "";
        let artist = track.info.author || "";
        title = title
            .replace(/\s*[\(\[](?:official|lyric|music|audio|video|hd|hq|4k|visualizer|feat\.|ft\.).*?[\)\]]/gi, "")
            .replace(/\s*\|.*$/, "")
            .trim();
        const titleDash = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
        if (titleDash && (!artist || artist === "Unknown" || artist === "Unknown Artist")) {
            artist = titleDash[1].trim();
            title = titleDash[2].trim();
        }
        artist = artist
            .replace(/\s*[-–—]\s*Topic$/i, "")
            .replace(/VEVO$/i, "")
            .trim();
        return { trackName: title, artistName: artist };
    }
    async _fetchNodeLinkLyrics(encodedTrack) {
        if (!encodedTrack)
            return null;
        try {
            const node = config.nodes?.[0];
            if (!node || !node.host || !node.port)
                return null;
            const protocol = node.secure ? 'https' : 'http';
            const url = `${protocol}://${node.host}:${node.port}/v4/loadlyrics?encodedTrack=${encodeURIComponent(encodedTrack)}`;
            const res = await fetch(url, {
                headers: {
                    Authorization: node.authorization
                }
            });
            if (res.ok) {
                const json = await res.json();
                if (json.loadType === "lyrics" && json.data) {
                    const data = json.data;
                    // @ts-ignore
                    const syncedLines = (data.lines || []).map(line => ({
                        timeMs: line.timestamp || line.time || 0,
                        text: line.line || line.text || ""
                        // @ts-ignore
                    })).filter(l => l.text);
                    return {
                        trackName: data.track?.title || "Unknown",
                        artistName: data.track?.author || "Unknown",
                        albumName: data.track?.album || "",
                        duration: 0,
                        // @ts-ignore
                        plainLyrics: data.text || syncedLines.map(l => l.text).join("\n"),
                        syncedLyrics: "",
                        syncedLines,
                        source: "NodeLink Native API"
                    };
                }
            }
        }
        catch (error) {
            // @ts-ignore
            logger.debug("LyricsCommand", `NodeLink native lyrics fetch failed: ${error.message}`);
        }
        return null;
    }
    async _fetchLyrics(trackName, artistName, durationMs, encodedTrack) {
        if (encodedTrack) {
            const nodeLinkResult = await this._fetchNodeLinkLyrics(encodedTrack);
            if (nodeLinkResult && (nodeLinkResult.syncedLines.length > 0 || nodeLinkResult.plainLyrics)) {
                logger.info("LyricsCommand", `Successfully loaded lyrics via NodeLink Native API for: ${trackName}`);
                return nodeLinkResult;
            }
        }
        if (!trackName)
            return null;
        const query = { track_name: trackName };
        // @ts-ignore
        if (artistName)
            query.artist_name = artistName;
        // @ts-ignore
        if (durationMs && durationMs > 0)
            query.duration = Math.round(durationMs / 1000);
        try {
            // @ts-ignore
            const result = await lrclib.findLyrics(query);
            if (result && (result.syncedLyrics || result.plainLyrics)) {
                return this._normalizeLrcResult(result);
            }
        }
        catch (_) { }
        try {
            const queryNoDur = { track_name: trackName };
            // @ts-ignore
            if (artistName)
                queryNoDur.artist_name = artistName;
            // @ts-ignore
            const result = await lrclib.findLyrics(queryNoDur);
            if (result && (result.syncedLyrics || result.plainLyrics)) {
                return this._normalizeLrcResult(result);
            }
        }
        catch (_) { }
        try {
            const searchResults = await lrclib.searchLyrics({
                // @ts-ignore
                q: artistName ? `${artistName} ${trackName}` : trackName,
            });
            if (searchResults && searchResults.length > 0) {
                const best = searchResults.find(r => r.syncedLyrics) || searchResults[0];
                if (best && (best.syncedLyrics || best.plainLyrics)) {
                    return this._normalizeLrcResult(best);
                }
            }
        }
        catch (_) { }
        return null;
    }
    _normalizeLrcResult(result) {
        const data = {
            trackName: result.trackName || result.name || "Unknown",
            artistName: result.artistName || "Unknown",
            albumName: result.albumName || "",
            duration: result.duration || 0,
            plainLyrics: result.plainLyrics || "",
            syncedLyrics: result.syncedLyrics || "",
            syncedLines: [],
            source: "LRCLIB",
        };
        if (data.syncedLyrics) {
            // @ts-ignore
            data.syncedLines = this._parseLRC(data.syncedLyrics);
        }
        return data;
    }
    _parseLRC(lrcText) {
        const lines = [];
        const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/;
        for (const raw of lrcText.split("\n")) {
            const match = raw.match(regex);
            if (match) {
                const mins = parseInt(match[1]);
                const secs = parseInt(match[2]);
                const ms = match[3].length === 2 ? parseInt(match[3]) * 10 : parseInt(match[3]);
                const timeMs = (mins * 60 + secs) * 1000 + ms;
                const text = match[4].trim();
                if (text)
                    lines.push({ timeMs, text });
            }
        }
        return lines;
    }
    // @ts-ignore
    async _handleLyricsDisplay(msgOrInt, lyricsData, track, player, client, guildId, userId, isInteraction) {
        const hasSynced = lyricsData.syncedLines.length > 0;
        const isPlaying = player && player.queue?.current;
        if (hasSynced && isPlaying) {
            await this._displayLiveLyrics(msgOrInt, lyricsData, track, player, client, guildId, userId, isInteraction);
        }
        else if (lyricsData.plainLyrics) {
            // @ts-ignore
            await this._displayStaticLyrics(msgOrInt, lyricsData, track, guildId, userId, isInteraction);
        }
        else {
            const container = this._createErrorContainer("Lyrics data is incomplete or unavailable.");
            if (isInteraction) {
                await msgOrInt.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            else {
                await msgOrInt.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
        }
    }
    // @ts-ignore
    async _displayLiveLyrics(msgOrInt, lyricsData, track, player, client, guildId, userId, isInteraction) {
        let currentLineIdx = -1;
        let isActive = true;
        let lastEditTime = 0;
        const getPosition = () => {
            try {
                return player.position || 0;
            }
            catch {
                return 0;
            }
        };
        const title = track?.info?.title || 'Unknown Track';
        const artist = track?.info?.author || 'Unknown Artist';
        const artworkUrl = track?.info?.artworkUrl || track?.info?.uri;
        // @ts-ignore
        const buildLiveContainer = (positionMs) => {
            // @ts-ignore
            const { currentIdx, currentLine, prevLines, nextLines } = this._getSyncContext(lyricsData.syncedLines, positionMs);
            const container = buildContainer({
                title: "`🎤 **Live Lyrics**`",
                content: `🎵 **${this._truncate(title, 45)}**\n🎤 ${this._truncate(artist, 40)}`,
                thumbnail: artworkUrl,
                icon: emoji.get("info") || "ℹ️"
            });
            // @ts-ignore
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
            const lyricsContent = prevLines.map((l) => l.text).join('\n') +
                `\n> **${currentLine?.text || ''}**\n` +
                nextLines.map((l) => l.text).join('\n');
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lyricsContent));
            // @ts-ignore
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
            const albumInfo = lyricsData.albumName ? `  •  💿 ${lyricsData.albumName}` : "";
            container.addTextDisplayComponents(
            // @ts-ignore
            new TextDisplayBuilder().setContent(`-# 📖 Source: LRCLIB${albumInfo}`));
            return container;
        };
    }
    _createLoadingContainer() {
        const info = "**Searching Lyric Libraries**\n└─ Fetching synchronized lyrics...";
        const container = buildContainer({
            title: "Fetching Lyrics",
            content: `${info}\n\n*Try using \`lyrics Artist - Song Name\` for better results*`,
            thumbnail: config.assets?.defaultTrackArtwork,
            icon: emoji.get("loading") || "ℹ️"
        });
        return container;
    }
    _getPaginationButtons(page, total, guildId, userId) {
        return new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId(`lyp_prev_${guildId}`)
            .setLabel("Previous")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0), new ButtonBuilder()
            .setCustomId(`lyp_page_${guildId}`)
            .setLabel(`${page + 1} / ${total}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true), new ButtonBuilder()
            .setCustomId(`lyp_next_${guildId}`)
            .setLabel("Next")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === total - 1));
    }
    // @ts-ignore
    _chunkLyrics(lyrics, maxLength = 1500) {
        const chunks = [];
        const lines = lyrics.split("\n");
        let current = "";
        for (const line of lines) {
            if ((current + line + "\n").length > maxLength) {
                if (current.trim())
                    chunks.push(current.trim());
                current = line + "\n";
            }
            else {
                current += line + "\n";
            }
        }
        if (current.trim())
            chunks.push(current.trim());
        return chunks.length > 0 ? chunks : ["No lyrics available"];
    }
    // @ts-ignore
    _createProgressBar(currentMs, totalMs, length = 16) {
        if (!totalMs || totalMs <= 0)
            return "▒".repeat(length);
        const progress = Math.max(0, Math.min(1, currentMs / totalMs));
        const filled = Math.round(progress * length);
        const empty = length - filled;
        return "█".repeat(filled) + "░".repeat(empty);
    }
    _fmt(ms) {
        if (!ms || ms < 0)
            return "0:00";
        const secs = Math.floor((ms / 1000) % 60).toString().padStart(2, "0");
        const mins = Math.floor((ms / (1000 * 60)) % 60);
        const hrs = Math.floor(ms / (1000 * 60 * 60));
        return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
    }
    _truncate(str, maxLen) {
        if (!str)
            return "";
        return str.length > maxLen ? str.substring(0, maxLen - 1) + "…" : str;
    }
    _createErrorContainer(msg) {
        return buildError(msg);
    }
    _createNotFoundContainer(trackName, artistName) {
        return buildError(phrases.get("lyricNotFound"));
    }
}
export default new LyricsCommand();
