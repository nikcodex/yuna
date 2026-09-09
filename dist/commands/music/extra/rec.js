import { ActionRowBuilder, MessageFlags, StringSelectMenuBuilder, } from "discord.js";
import { Command } from '#core/Command';
import { PlayerManager } from '#audio/PlayerManager';
import { db } from '#database/Database';
import { config } from "#config/config";
import { logger } from "#utils/logger";
import { buildContainer, buildError } from '#ui/Theme';
import AutoplayEngine from '#audio/AutoplayEngine';
import emoji from "#config/emoji";
import phrases from "#utils/phrases";
// @ts-ignore
const autoplayEngine = new AutoplayEngine();
class RecommendationsCommand extends Command {
    constructor() {
        super({
            name: "recommendations",
            description: "Get song recommendations based on what's currently playing",
            usage: "recommendations",
            aliases: ["rec", "recommend", "similar"],
            category: "music",
            examples: ["recommendations", "rec", "similar"],
            cooldown: 5,
            access: {
                voice: true,
                player: true,
                playing: true,
            },
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: "recommendations",
                    description: "Get song recommendations based on what is currently playing",
                },
            },
        });
    }
    async execute(ctx) {
        const { client, message, interaction, player, pm, args = [] } = ctx;
        const context = interaction || message;
        return this._handleRecommendations(client, context.guild.id, context);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    // @ts-ignore
    async _handleRecommendations(client, guildId, context) {
        const player = client.music?.getPlayer(guildId);
        if (!player || !player.queue.current) {
            return this._reply(context, buildError(phrases.get("noTrackPlaying"), "Player Error"));
        }
        const currentTrack = player.queue.current;
        const loadingContainer = buildContainer({
            title: "Finding Recommendations",
            content: `### 🔄 **Scanning Recommendation Engine**\n└─ Finding songs similar to **"${currentTrack.info.title}"**...`,
            thumbnail: currentTrack.info.artworkUrl || config.assets.defaultTrackArtwork,
            icon: emoji.get("music") || "🎵"
        });
        const loadingMessage = await this._reply(context, loadingContainer);
        try {
            if (!autoplayEngine.client) {
                autoplayEngine.client = client;
            }
            const recommendations = await autoplayEngine.getRecommendations(player, currentTrack, 6);
            if (!recommendations || recommendations.length === 0) {
                const noResultsContainer = buildError(`No recommendations found for "${currentTrack.info.title}" by ${currentTrack.info.author}.`, "No Results");
                return this._updateMessage(loadingMessage, noResultsContainer, context);
            }
            // @ts-ignore
            const userId = context.user?.id || context.author?.id;
            const container = this._buildRecommendationsContainer(currentTrack, recommendations, guildId, userId);
            const message = await this._updateMessage(loadingMessage, container, context);
            if (message) {
                this._setupCollector(message, client, context, player, recommendations);
            }
        }
        catch (error) {
            // @ts-ignore
            logger.error("RecommendationsCommand", `Error fetching recommendations: ${error.message}`, error);
            const errorContainer = buildError("Failed to fetch recommendations. Please try again later.", "Recommendation Error");
            await this._updateMessage(loadingMessage, errorContainer, context);
        }
    }
    _buildRecommendationsContainer(currentTrack, recommendations, guildId, userId) {
        const premiumStatus = this._getPremiumStatus(guildId, userId);
        let content = `### 🎵 **Recommended Tracks**\n` +
            `└─ Based on **"${currentTrack.info.title}"** by **${currentTrack.info.author}**\n\n`;
        // @ts-ignore
        recommendations.forEach((rec, idx) => {
            content += `├─ **${idx + 1}.** ${rec.name} — *${rec.artist}*\n`;
        });
        content += `\n*Select up to ${Math.min(recommendations.length, 6)} songs below to queue them instantly.*`;
        const container = buildContainer({
            title: "Music Recommendations",
            content: content,
            thumbnail: currentTrack.info.artworkUrl || config.assets.defaultTrackArtwork,
            icon: emoji.get("music") || "🎵"
        });
        const selectMenu = this._createSelectMenu(recommendations, userId);
        if (selectMenu) {
            // @ts-ignore
            container.addActionRowComponents(selectMenu);
        }
        return container;
    }
    _getPremiumStatus(guildId, userId) {
        const premiumStatus = db.hasAnyPremium(userId, guildId);
        return {
            hasPremium: !!premiumStatus,
            type: premiumStatus ? premiumStatus.type : 'free',
            maxSongs: premiumStatus ? config.queue.maxSongs.premium : config.queue.maxSongs.free
        };
    }
    _createSelectMenu(recommendations, userId) {
        if (!recommendations || recommendations.length === 0)
            return null;
        const maxSelections = Math.min(recommendations.length, 6);
        // @ts-ignore
        const options = recommendations.map((rec) => ({
            label: rec.name.substring(0, 95),
            value: `rec_idx_${rec.index}`,
            description: `by ${rec.artist}`.substring(0, 95),
            emoji: "🎵"
        }));
        return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId(`rec_select_${userId}`)
            .setPlaceholder(`Select up to ${maxSelections} songs to add to queue`)
            .setMinValues(1)
            .setMaxValues(maxSelections)
            .addOptions(options));
    }
    // @ts-ignore
    async _setupCollector(message, client, context, player, recommendations) {
        // @ts-ignore
        const userId = context.user?.id || context.author?.id;
        // @ts-ignore
        const filter = (i) => i.customId === `rec_select_${userId}` && i.user.id === userId;
        const collector = message.createMessageComponentCollector({ filter, time: 120_000 });
        // @ts-ignore
        collector.on("collect", async (interaction) => {
            try {
                await interaction.deferUpdate();
                // @ts-ignore
                const selectedIndices = interaction.values.map(val => parseInt(val.replace("rec_idx_", "")));
                // @ts-ignore
                const selectedRecs = recommendations.filter(r => selectedIndices.includes(r.index));
                if (!selectedRecs.length)
                    return;
                const pm = new PlayerManager(player);
                const addedNames = [];
                for (const rec of selectedRecs) {
                    try {
                        let searchResult;
                        if (rec.trackInfo) {
                            searchResult = { tracks: [rec.trackInfo] };
                        }
                        else {
                            searchResult = await client.music.search(`${rec.artist} ${rec.name}`, { source: "spsearch" });
                        }
                        if (searchResult?.tracks?.length > 0) {
                            await pm.addTracks(searchResult.tracks[0]);
                            addedNames.push(`"${rec.name}" by ${rec.artist}`);
                        }
                    }
                    catch (e) {
                        logger.warn("RecommendationsCommand", `Failed to add track: ${rec.name}`, e);
                    }
                }
                if (addedNames.length > 0) {
                    let successContent = `### 🎶 **Tracks Added to Queue**\n` +
                        `└─ Added **${addedNames.length}** recommended song${addedNames.length > 1 ? 's' : ''} to queue!\n\n`;
                    addedNames.forEach((name, i) => {
                        const isLast = i === addedNames.length - 1;
                        successContent += `${isLast ? '└─' : '├─'} **${i + 1}.** ${name}\n`;
                    });
                    const successContainer = buildContainer({
                        title: "Recommendations Added",
                        content: successContent,
                        thumbnail: config.assets.defaultThumbnail,
                        icon: emoji.get("check") || "✅"
                    });
                    await interaction.editReply({
                        components: [successContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                    if (!player.playing && !player.paused && player.queue.tracks.length > 0) {
                        await player.play().catch(() => { });
                    }
                }
            }
            catch (err) {
                logger.error("RecommendationsCommand", "Error in recommendations collector:", err);
            }
        });
    }
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true,
        };
        try {
            // @ts-ignore
            if (context.editReply && (context.deferred || context.replied)) {
                // @ts-ignore
                return await context.editReply(payload);
            }
            // @ts-ignore
            return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
        }
        catch (e) {
            logger.error("RecommendationsCommand", "Failed to reply in Recommendations command:", e);
            return null;
        }
    }
    // @ts-ignore
    async _updateMessage(message, container, context) {
        try {
            // @ts-ignore
            if (context.replied || context.deferred) {
                // @ts-ignore
                return await context.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
            else {
                return await message.edit({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        }
        catch (error) {
            logger.error("RecommendationsCommand", "Failed to update recommendations message:", error);
            return message;
        }
    }
}
export default new RecommendationsCommand();
