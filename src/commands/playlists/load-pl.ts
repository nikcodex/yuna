import type { Message, Interaction, CommandInteraction } from 'discord.js';
import type { YunaClient } from '#core/YunaClient';
import { Command } from "#core/Command";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
import { PlayerManager } from "#audio/PlayerManager";
import { db } from "#database/Database";
import { config } from "#config/config";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import phrases from "#utils/phrases";

const MAX_TRACKS_TO_ADD = 50;

class LoadPlaylistCommand extends Command {
	constructor() {
		super({
			name: "load-playlist",
			description: "Load a playlist, or specific tracks/ranges from it",
			usage: "load-playlist <playlist_name_or_id> [positions]",
			aliases: ["load-pl", "lpl"],
			category: "music",
			examples: [
				"lpl My Favorites",
				"lpl ChillVibes 5",
				"load-pl MyFavorites: 3, 7, 10",
				"lpl RockClassics 5-10",
			],
			cooldown: 5,
			access: {
				voice: true,
			},
			slash: {
				enabled: true,
				autoDefer: true,
				data: {
					name: "load-playlist",
					description: "Load a playlist or specific tracks/ranges from it",
					options: [
						{
							name: "playlist",
							description: "Playlist ID or name to load",
							type: 3,
							required: true,
						},
						{
							name: "positions",
							description: "Optional: Specific tracks or ranges (e.g., 5, 8-10)",
							type: 3,
							required: false,
						},
					],
				},
			},
		});
	}

	async execute(ctx: any) {
		const { client, message, interaction, player, pm, args = [] } = ctx;
		const context = interaction || message;
		let positionsStr = null;
		let query = null;

		if (interaction) {
			query = interaction.options.getString("playlist");
			positionsStr = interaction.options.getString("positions") || null;
		} else {
			if (args.length === 0) {
				const container = this._createUsageContainer();
				return this._reply(context, container);
			}

			const lastArg = args[args.length - 1];
			if (args.length > 1 && /^[0-9,-]+$/.test(lastArg)) {
				positionsStr = args.pop();
				query = args.join(" ");
			} else {
				query = args.join(" ");
			}
		}

		return this._handleLoad(
			client,
			context,
			query,
			context.user || context.author,
			positionsStr,
		);
	}

	async slashExecute(ctx: any) {
		return this.execute(ctx);
	}

	async _handleLoad(client: any, context: any, query: any, user: any, positionsStr: any) {
		const loadingMessage = await this._reply(
			context,
			this._createLoadingContainer(query),
		);

		try {
			const playlist = this._findPlaylist(user.id, query);
			if (!playlist)
				return this._editReply(
					loadingMessage,
					this._createNotFoundContainer(query),
				);
			if (!playlist.tracks || playlist.tracks.length === 0)
				return this._editReply(
					loadingMessage,
					this._createEmptyPlaylistContainer(playlist),
				);

			let tracksToProcess;
			let selectionInfo;

			if (positionsStr) {
				const indices = this._parseTrackIndices(
					positionsStr,
					playlist.tracks.length,
				);
				if (indices.length === 0) {
					return this._editReply(
						loadingMessage,
						this._createErrorContainer(
							`**Invalid Track Selection**\n\nThe positions \`${positionsStr}\` are invalid or out of range for this playlist (1-${playlist.tracks.length}).`,
						),
					);
				}
				tracksToProcess = indices.map((index: number) => playlist.tracks[index]);
				selectionInfo = `${indices.length} selected track(s)`;
			} else {
				tracksToProcess = playlist.tracks.slice(0, MAX_TRACKS_TO_ADD);
				selectionInfo = `up to ${MAX_TRACKS_TO_ADD} tracks`;
			}

			const voiceChannel = context.member?.voice?.channel;
			if (!voiceChannel)
				return this._editReply(
					loadingMessage,
					this._createErrorContainer(
						`**Voice Channel Required**\n\nYou must be in a voice channel to play music.`,
					),
				);
			const permissions = voiceChannel.permissionsFor(context.guild.members.me);
			if (!permissions.has(["Connect", "Speak"]))
				return this._editReply(
					loadingMessage,
					this._createErrorContainer(
						`**Missing Permissions**\n\nI need permission to join and speak in your voice channel.`,
					),
				);

			let player = client.music?.getPlayer(context.guild.id);
			const wasEmpty =
				!player || (player.queue.tracks.length === 0 && !player.playing);
			const currentQueueSize = wasEmpty ? 0 : player.queue.tracks.length;
			const queueCheck = this._checkQueueLimit(
				currentQueueSize,
				tracksToProcess.length,
				context.guild.id,
				user.id,
			);

			if (!queueCheck.allowed)
				return this._editReply(
					loadingMessage,
					this._createErrorContainer(
						`**Queue Limit Reached**\n\n${queueCheck.message}`,
					),
				);

			if (!player)
				player = await client.music.createPlayer({
					guildId: context.guild.id,
					textChannelId: context.channel.id,
					voiceChannelId: voiceChannel.id,
				});
			const pm = new PlayerManager(player);
			if (!pm.isConnected) await pm.connect();

			const finalTracks = tracksToProcess.slice(0, queueCheck.tracksToAdd);
			let addedCount = 0;
			let failedCount = 0;

			await this._editReply(
				loadingMessage,
				this._createProcessingContainer(
					playlist.name,
					0,
					finalTracks.length,
					selectionInfo,
				),
			);

			const BATCH_SIZE = 10;
			for (let i = 0; i < finalTracks.length; i += BATCH_SIZE) {
				const batch = finalTracks.slice(i, i + BATCH_SIZE);
				
				const searchResults = await Promise.all(batch.map(async (track: any) => {
					const searchQuery = track.uri || track.identifier || (track.author ? `${track.title} ${track.author}` : track.title);
					return client.music.search(searchQuery, { requester: user });
				}));

				for (const searchResult of searchResults) {
					if (searchResult?.tracks?.length > 0) {
						await pm.addTracks(searchResult.tracks[0]);
						addedCount++;
					} else {
						failedCount++;
					}
				}
			}

			if (wasEmpty && addedCount > 0) await pm.play();

			const premiumStatus = this._getPremiumStatus(context.guild.id, user.id);
			return this._editReply(
				loadingMessage,
				this._createSuccessContainer(
					playlist,
					addedCount,
					failedCount,
					finalTracks.length,
					premiumStatus,
					queueCheck.limitWarning,
					wasEmpty && addedCount > 0,
				),
			);
		} catch (error: any) {
			logger.error("LoadPlaylistCommand", "Error loading playlist", error);
			return this._editReply(
				loadingMessage,
				this._createErrorContainer(
					`An unexpected error occurred while loading the playlist.`,
				),
			);
		}
	}

	_parseTrackIndices(str: string, max: number): number[] {
		const indices = new Set<number>();
		const parts = str.split(",");

		for (const part of parts) {
			if (part.includes("-")) {
				const [start, end] = part.trim().split("-").map(Number);
				if (
					!isNaN(start) &&
					!isNaN(end) &&
					start <= end &&
					start > 0 &&
					end <= max
				) {
					for (let i = start; i <= end; i++) {
						indices.add(i - 1);
					}
				}
			} else {
				const num = Number(part.trim());
				if (!isNaN(num) && num > 0 && num <= max) {
					indices.add(num - 1);
				}
			}
		}
		return Array.from(indices);
	}

	_findPlaylist(userId: any, query: any) {
		const userPlaylists = db.playlists.getUserPlaylists(userId);
		const trimmedQuery = query.trim();
		if (trimmedQuery.startsWith("pl_"))
			return userPlaylists.find((p) => p.id === trimmedQuery);
		if (trimmedQuery.length <= 16 && !trimmedQuery.includes(" ")) {
			const byId = userPlaylists.find((p) => p.id.includes(trimmedQuery));
			if (byId) return byId;
		}
		return userPlaylists.find(
			(p) => p.name.toLowerCase() === trimmedQuery.toLowerCase(),
		);
	}

	_createUsageContainer() {
		const content =
			`**Usage:** \`load-playlist <name_or_id> [positions]\`\n\n` +
			`Load an entire playlist or just specific tracks.\n\n` +
			`**Examples:**\n` +
			`└─ \`lpl My Favorites\` (loads all)\n` +
			`└─ \`lpl ChillVibes 5\` (loads track 5)\n` +
			`└─ \`lpl MyFavorites: 3,7,10\` (loads: 3, 7, 10)\n` +
			`└─ \`lpl RockClassics 5-10\` (loads 5 through 10)`;

		return buildContainer({
			title: "Load Playlist Command",
			content: content,
			thumbnail: null,
			icon: emoji.get("info") || "ℹ️"
		});
	}

	_createProcessingContainer(
		playlistName: any,
		processedCount: any,
		totalCount: any,
		selectionInfo: any,
	) {
		const progress = Math.round((processedCount / totalCount) * 100) || 0;
		const content =
			`**Adding songs to queue...**\n\n` +
			`**${emoji.get("folder")} Playlist:** ${playlistName}\n` +
			`**${emoji.get("music")} Selection:** Loading ${selectionInfo}\n` +
			`**${emoji.get("loading")} Progress:** ${processedCount}/${totalCount} (${progress}%)`;

		return buildContainer({
			title: "Loading Playlist Tracks",
			content: content,
			thumbnail: null,
			icon: emoji.get("loading") || "ℹ️"
		});
	}

	_createSuccessContainer(
		playlist: any,
		added: any,
		failed: any,
		totalSelected: any,
		premium: any,
		limitWarning: any,
		wasPlaying: any,
	) {
		const statusText = wasPlaying ? "Started playing: " : "Added to queue";
		const title = added > 0 ? "Playlist Loaded Successfully" : "Failed to Load Playlist";
		const note = phrases.get("playlistLoaded");
		const content =
			`**Loaded tracks from ${playlist.name}**\n\n` +
			`**${emoji.get("check")} Added:** ${added} / ${totalSelected} selected tracks\n` +
			`${failed > 0 ? `**${emoji.get("cross")} Failed:** ${failed} tracks (not found)\n` : ""}` +
			`**${emoji.get("music")} Status:** ${statusText}\n\n` +
			`**Queue Info:** ${premium.hasPremium ? "Premium" : "Free"} Tier (${premium.maxSongs} limit)\n` +
			`${limitWarning ? `**${emoji.get("info")} Notice:** ${limitWarning}\n` : ""}` +
			`\n*${note}*`;

		return buildSuccess(content, title);
	}

	_createLoadingContainer(query: any) { return buildContainer({ title: "Loading", content: `**Loading playlist \`${query}\`...**`, icon: emoji.get("loading") || "ℹ️" }); }
	_createNotFoundContainer(query: any) { return buildError(`Could not find a playlist matching \`${query}\`.`, "Playlist Not Found"); }
	_createEmptyPlaylistContainer(playlist: any) { return buildContainer({ title: "Empty Playlist", content: `The playlist \`${playlist.name}\` has no tracks to load.`, icon: emoji.get("info") || "ℹ️" }); }
	_createErrorContainer(message: string) { return buildError(message, "Error"); }
	_getPremiumStatus(guildId: any, userId: any) {
		const premiumStatus = db.hasAnyPremium(userId, guildId);
		return {
			hasPremium: !!premiumStatus,
			maxSongs: premiumStatus
				? config.queue.maxSongs.premium
				: config.queue.maxSongs.free,
		};
	}
	_checkQueueLimit(currentQueueSize: any, tracksToAdd: any, guildId: any, userId: any) {
		const premiumStatus = this._getPremiumStatus(guildId, userId);
		const availableSlots = premiumStatus.maxSongs - currentQueueSize;
		if (availableSlots <= 0)
			return {
				allowed: false,
				message: `Queue is full (${premiumStatus.maxSongs} songs).`,
			};
		const canAddAll = tracksToAdd <= availableSlots;
		const tracksToAddActual = canAddAll ? tracksToAdd : availableSlots;
		let limitWarning = !canAddAll
			? `Only ${tracksToAddActual} tracks could be added due to queue limit.`
			: null;
		return {
			allowed: true,
			canAddAll,
			tracksToAdd: tracksToAddActual,
			limitWarning,
		};
	}
	async _reply(context: any, container: any) {
		const payload = {
			components: [container],
			flags: MessageFlags.IsComponentsV2,
			fetchReply: true,
		};
		if (context.replied || context.deferred) return context.editReply(payload);
		return (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
	}
	async _editReply(message: any, container: any) {
		if (!message) return null;
		return message.edit({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	}
}

export default new LoadPlaylistCommand();
