import type { Message, Interaction, CommandInteraction } from 'discord.js';
import type { YunaClient } from '#core/YunaClient';
import { Command } from "#core/Command";
import { ButtonStyle, MessageFlags, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder } from "discord.js";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
import { db } from "#database/Database";
import { config } from "#config/config";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import phrases from "#utils/phrases";

class Add2PlaylistCommand extends Command {
	constructor() {
		super({
			name: "add2pl",
			description: "Add current track or entire queue to a playlist",
			usage: "add2pl [playlist_name/id]",
			aliases: ["add-to-playlist", "a2pl"],
			category: "music",
			examples: ["add2pl", "add2pl My Favorites", "add2pl pl_abc123"],
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
					name: "add2pl",
					description: "Add current track or entire queue to a playlist",
					options: [
						{
							name: "playlist",
							description: "Playlist name or ID",
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
		const playlistIdentifier = interaction ? (interaction.options.getString("playlist") || null) : (args.join(" ") || null);
		return this._handleAdd2Playlist(client, context, playlistIdentifier);
	}

	async slashExecute(ctx: any) {
		return this.execute(ctx);
	}

	async _handleAdd2Playlist(client: any, context: any, playlistIdentifier: any) {
		const userId = context.user?.id || context.author?.id;
		const guildId = context.guild.id;
		const player = client.music?.getPlayer(guildId);

		if (!player || !player.queue.current) {
			return this._reply(
				context,
				this._createErrorContainer("No music is currently playing."),
			);
		}

		if (playlistIdentifier) {
			return this._handleDirectAdd(context, userId, player, playlistIdentifier);
		} else {
			return this._showPlaylistSelection(context, userId, player);
		}
	}

	async _handleDirectAdd(context: any, userId: any, player: any, playlistIdentifier: any) {
		const playlist = this._findPlaylist(userId, playlistIdentifier);
		if (!playlist) {
			return this._reply(
				context,
				this._createErrorContainer(
					"Playlist not found. Check the name or ID and try again.",
				),
			);
		}

		const message = await this._reply(
			context,
			this._createPlaylistFoundContainer(playlist, player),
		);

		if (message) {
			this._setupDirectCollector(message, context, userId, player, playlist);
		}
	}

	async _showPlaylistSelection(context: any, userId: any, player: any) {
		const playlists = db.playlists.getUserPlaylists(userId);
		if (playlists.length === 0) {
			return this._reply(context, this._createNoPlaylistsContainer());
		}

		const message = await this._reply(
			context,
			this._createSelectionContainer(playlists, player),
		);

		if (message) {
			this._setupSelectionCollector(
				message,
				context,
				userId,
				player,
				playlists,
			);
		}
	}

	_findPlaylist(userId: any, identifier: any) {
		const playlists = db.playlists.getUserPlaylists(userId);

		return playlists.find(
			(pl) =>
				pl.id === identifier ||
				pl.name.toLowerCase() === identifier.toLowerCase() ||
				pl.id.replace("pl_", "").substring(0, 8) === identifier.toLowerCase(),
		);
	}

	_createNoPlaylistsContainer() {
		const content =
			`**No Playlists Found**\n\n` +
			`**${emoji.get("cross")} Status:** No playlists available\n\n` +
			`You don't have any playlists to add tracks to.\n\n` +
			`**${emoji.get("add")} Create your first playlist:**\n` +
			`└─ Use \`create-playlist <name>\`\n\n` +
			`*Create a playlist and come back to add tracks*`;

		return buildContainer({
			title: "Add to Playlist",
			content: content,
			thumbnail: config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork,
			icon: emoji.get("info") || "ℹ️"
		});
	}

	_createSelectionContainer(playlists: any, player: any) {
		const current = player.queue.current;
		const queueCount = player.queue.tracks.length;
		const content =
			`**Select a Playlist**\n\n` +
			`**${emoji.get("music")} Current Track:** ${current.info.title}\n` +
			`**${emoji.get("folder")} Queue:** ${queueCount} tracks\n` +
			`**${emoji.get("info")} Your Playlists:** ${playlists.length}\n\n` +
			`Choose a playlist below, then select what to add:\n` +
			`└─ Current track only\n` +
			`└─ Entire queue\n\n` +
			`*Select a playlist from the dropdown menu*`;

		const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
				.setCustomId("playlist_select")
				.setPlaceholder("Choose a playlist...")
				.addOptions(
					playlists.slice(0, 25).map((pl: any) => ({
						label: pl.name,
						description: `${pl.track_count}/50 tracks`,
						value: pl.id,
						emoji: "🎵",
					})),
				),
		);

		return buildContainer({
			title: "Add to Playlist",
			content: content,
			thumbnail: current.info.artworkUrl || config.assets?.defaultTrackArtwork,
			components: [selectMenu],
			icon: emoji.get("add") || "ℹ️"
		});
	}

	_createPlaylistFoundContainer(playlist: any, player: any) {
		const current = player.queue.current;
		const queueCount = player.queue.tracks.length;
		const availableSlots = 50 - playlist.track_count;
		const content =
			`**Ready to Add Tracks**\n\n` +
			`**${emoji.get("music")} Current Track:** ${current.info.title}\n` +
			`**${emoji.get("folder")} Queue:** ${queueCount} tracks\n` +
			`**${emoji.get("info")} Playlist:** ${playlist.track_count}/50 tracks\n` +
			`**${emoji.get("add")} Available Slots:** ${availableSlots}\n\n` +
			`Choose what to add to this playlist:\n\n` +
			`*Use the buttons below to make your selection*`;

		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
				.setCustomId("add_current")
				.setLabel("Add Current Track")
				.setStyle(ButtonStyle.Primary)
				.setEmoji(emoji.get("add") || "➕"),
			new ButtonBuilder()
				.setCustomId("add_queue")
				.setLabel(`Add Queue (${queueCount + 1})`)
				.setStyle(ButtonStyle.Secondary)
				.setEmoji(emoji.get("folder") || "📁"),
		);

		return buildContainer({
			title: playlist.name,
			content: content,
			thumbnail: current.info.artworkUrl || config.assets?.defaultTrackArtwork,
			components: [buttons],
			icon: emoji.get("folder") || "ℹ️"
		});
	}

	_createAddContainer(playlists: any, player: any, selectedPlaylist: any) {
		const current = player.queue.current;
		const queueCount = player.queue.tracks.length;
		const availableSlots = 50 - selectedPlaylist.track_count;
		const content =
			`**Choose What to Add**\n\n` +
			`**${emoji.get("music")} Current Track:** ${current.info.title}\n` +
			`**${emoji.get("folder")} Queue:** ${queueCount} tracks\n` +
			`**${emoji.get("info")} Playlist:** ${selectedPlaylist.track_count}/50 tracks\n` +
			`**${emoji.get("add")} Available Slots:** ${availableSlots}\n\n` +
			`Select what you want to add to this playlist:\n\n` +
			`*Use the buttons below to make your selection*`;

		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
				.setCustomId("add_current")
				.setLabel("Add Current Track")
				.setStyle(ButtonStyle.Primary)
				.setEmoji(emoji.get("add") || "➕"),
			new ButtonBuilder()
				.setCustomId("add_queue")
				.setLabel(`Add Queue (${queueCount + 1})`)
				.setStyle(ButtonStyle.Secondary)
				.setEmoji(emoji.get("folder") || "📁"),
		);

		return buildContainer({
			title: selectedPlaylist.name,
			content: content,
			thumbnail: current.info.artworkUrl || config.assets?.defaultTrackArtwork,
			components: [buttons],
			icon: emoji.get("folder") || "ℹ️"
		});
	}

	_createSuccessContainer(playlist: any, addedCount: any, skippedCount: any, action: any) {
		const actionText = action === "current" ? "Current Track" : "Entire Queue";
		const note = phrases.get("playlistUpdated");
		const statusText = skippedCount > 0 ? `*Some tracks were skipped due to limits*` : `*${note}*`;
		const content =
			`**Tracks Added to Playlist**\n\n` +
			`**${emoji.get("folder")} Playlist:** ${playlist.name}\n` +
			`**${emoji.get("add")} Action:** Added ${actionText}\n` +
			`**${emoji.get("check")} Added:** ${addedCount} track${addedCount > 1 ? "s" : ""}\n` +
			`**${emoji.get("info")} Total:** ${playlist.track_count}/50 tracks\n` +
			`${skippedCount > 0 ? `**${emoji.get("cross")} Skipped:** ${skippedCount} track${skippedCount > 1 ? "s" : ""}\n` : ""}` +
			`\n${statusText}\n\n` +
			`**${emoji.get("info")} Next Steps:**\n` +
			`└─ Use \`my-playlists\` to view all playlists\n` +
			`└─ Use \`playlist-info ${playlist.name}\` for details\n` +
			`└─ Use \`load-pl ${playlist.name}\` to play`;

		return buildSuccess(content, "Successfully Added");
	}

	_createErrorContainer(message: string) {
		return buildError(message, "Error");
	}

	_setupSelectionCollector(message: any, context: any, userId: any, player: any, playlists: any) {
		const filter = (i: any) => i.user.id === userId;
		const collector = message.createMessageComponentCollector({
			filter,
			time: 300000,
		});

		let selectedPlaylist: any = null;

		collector.on("collect", async (interaction: any) => {
			await interaction.deferUpdate();

			try {
				if (interaction.customId === "playlist_select") {
					const playlistId = interaction.values[0];
					selectedPlaylist = playlists.find((pl: any) => pl.id === playlistId);

					if (selectedPlaylist) {
						await interaction.editReply({
							components: [this._createPlaylistFoundContainer(selectedPlaylist, player)],
							flags: MessageFlags.IsComponentsV2,
						});
					}
				} else if (
					interaction.customId === "add_current" ||
					interaction.customId === "add_queue"
				) {
					if (selectedPlaylist) {
						const action = interaction.customId;
						const result: any = await this._processAdd(interaction, userId, player, selectedPlaylist, action);

						if (result?.success) {
							const { addedCount, skippedCount } = result;
							await interaction.editReply({
								components: [
									this._createSuccessContainer(
										selectedPlaylist,
										addedCount,
										skippedCount,
										action.replace("add_", ""),
									),
								],
								flags: MessageFlags.IsComponentsV2,
							});
						} else {
							await interaction.editReply({
								components: [this._createErrorContainer(result?.message || "Failed to add tracks")],
								flags: MessageFlags.IsComponentsV2,
							});
						}
					}
				}
			} catch (error: any) {
				logger.error("Add2PlaylistCommand", "Error processing collector", error);
				await interaction.editReply({
					components: [this._createErrorContainer("An error occurred while adding tracks.")],
					flags: MessageFlags.IsComponentsV2,
				});
			}
		});

		collector.on("end", async () => {
			try {
				await message.edit({
					components: [this._createExpiredContainer()],
					flags: MessageFlags.IsComponentsV2,
				});
			} catch (error: any) {
				if (error.code !== 10008) {
					logger.error(
						"Add2PlaylistCommand",
						"Error updating expired message",
						error,
					);
				}
			}
		});
	}

	_setupDirectCollector(message: any, context: any, userId: any, player: any, playlist: any) {
		const filter = (i: any) => i.user.id === userId;
		const collector = message.createMessageComponentCollector({
			filter,
			time: 300000,
		});

		collector.on("collect", async (interaction: any) => {
			await interaction.deferUpdate();
			await this._processAdd(
				interaction,
				userId,
				player,
				playlist,
				interaction.customId,
			);
		});

		collector.on("end", async () => {
			try {
				await message.edit({
					components: [this._createExpiredContainer()],
					flags: MessageFlags.IsComponentsV2,
				});
			} catch (error: any) {
				if (error.code !== 10008) {
					logger.error(
						"Add2PlaylistCommand",
						"Error updating expired message",
						error,
					);
				}
			}
		});
	}

	async _processAdd(interaction: any, userId: any, player: any, playlist: any, action: any) {
		try {
			const current = player.queue.current;
			const queue = player.queue.tracks;
			let tracksToAdd = [];
			let addedCount = 0;
			let skippedCount = 0;

			if (action === "add_current") {
				tracksToAdd = [current];
			} else if (action === "add_queue") {
				tracksToAdd = [current, ...queue];
			}

			for (const track of tracksToAdd) {
				const availableSlots = 50 - (playlist.track_count + addedCount);
				if (availableSlots <= 0) break;

				const trackInfo = {
					identifier: track.info.identifier,
					title: track.info.title,
					author: track.info.author,
					uri: track.info.uri,
					duration: track.info.duration,
					sourceName: track.info.sourceName,
					artworkUrl: track.info.artworkUrl,
				};

				try {
					playlist = db.playlists.addTrackToPlaylist(
						playlist.id,
						userId,
						trackInfo,
					);
					addedCount++;
				} catch (error: any) {
					if (
						error.message.includes("already exists") ||
						error.message.includes("limit reached")
					) {
						skippedCount++;
					} else {
						throw error;
					}
				}
			}

			return { success: true, addedCount, skippedCount };
		} catch (error: any) {
			logger.error("Add2PlaylistCommand", "Error processing add", error);
			return { success: false, message: "An error occurred while adding tracks." };
		}
	}

	_createExpiredContainer() {
		const content =
			`**This interaction has expired**\n\n` +
			`**${emoji.get("reset")} Status:** Session timed out\n\n` +
			`Run the command again to add tracks to your playlists.\n\n` +
			`**${emoji.get("info")} Available Commands:**\n` +
			`└─ \`add2pl\` - Select from menu\n` +
			`└─ \`add2pl <playlist_name>\` - Direct add\n` +
			`└─ \`my-playlists\` - View all playlists\n\n` +
			`*Commands expire after 5 minutes of inactivity*`;

		return buildContainer({
			title: "Interaction Expired",
			content: content,
			thumbnail: config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork,
			icon: emoji.get("info") || "ℹ️"
		});
	}

	async _reply(context: any, container: any) {
		const payload = {
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		};

		try {
			if (context.replied || context.deferred) {
				return context.editReply({ ...payload, fetchReply: true });
			} else if (typeof context.reply === "function") {
				return (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))({ ...payload, fetchReply: true });
			} else {
				return context.channel.send(payload);
			}
		} catch (error: any) {
			logger.error("Add2PlaylistCommand", "Error in _reply", error);
			return null;
		}
	}
}

export default new Add2PlaylistCommand();

// Made by Nikhil Under CodeX Devs
