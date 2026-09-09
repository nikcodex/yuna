import { Command, CommandContext } from '#core/Command';
import {
	ActionRowBuilder,
	MessageFlags,
	SeparatorBuilder,
	SeparatorSpacingSize,
	StringSelectMenuBuilder,
	ComponentType,
	ButtonBuilder,
	ButtonStyle,
	UserSelectMenuBuilder,
	RoleSelectMenuBuilder,
	ChannelSelectMenuBuilder,
	MentionableSelectMenuBuilder,
} from "discord.js";
import type { Client, Message } from "discord.js";
import { PlayerManager } from '#audio/PlayerManager';
import { config } from "#config/config";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import { buildContainer, buildError } from '#ui/Theme';
import phrases from "#utils/phrases";

class SkipCommand extends Command {
	constructor() {
		super({
			name: "skip",
			description:
				"Skip the current track or jump to a specific track in the queue",
			usage: "skip [amount]",
			aliases: ["s", "next"],
			category: "music",
			examples: ["skip", "skip 3", "s 5", "next"],
			cooldown: 2,
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
					name: "skip",
					description: "Skip the current track or multiple tracks",
					options: [
						{
							name: "amount",
							description: "Number of tracks to skip (default: 1).",
							type: 4,
							required: false,
							min_value: 1,
						},
					],
				},
			},
		});
	}

	async execute(ctx: CommandContext) {
		const { client, message, interaction, player, pm, args = [] } = ctx;
		const context = interaction || message;
		const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
		if (!activePm) return;
		let amount = 1;
		if (interaction) {
			amount = interaction.options.getInteger("amount") || 1;
		} else if (args[0]) {
			amount = parseInt(args[0], 10);
		}
		if (isNaN(amount) || amount < 1) {
			return this._reply(
				context,
				this._createErrorContainer(ctx.t("errorGeneric")),
			);
		}
		return this._handleSkip(client, context, activePm, amount);
	}

	async slashExecute(ctx: CommandContext) {
		return this.execute(ctx);
	}

	async _handleSkip(client: Client, context: CommandContext, pm: PlayerManager, amount: number) {
		const queueSize = pm.queueSize;
		const skippedTrack = pm.currentTrack;

		if (amount > queueSize + 1) {
			return this._reply(
				context,
				this._createErrorContainer(
					`Cannot skip ${amount} tracks. Only ${queueSize} tracks are in the queue.`,
				),
			);
		}

		if (amount > queueSize) {
			const autoplayEnabled = pm.player?.get('autoplayEnabled') || false;
			await pm.skip();

			if (autoplayEnabled) {
				const container = buildContainer({
					title: "Track Skipped",
					content: `Skipped **${skippedTrack?.info?.title || 'track'}**. Autoplay is fetching the next song...`,
					thumbnail: skippedTrack?.info?.artworkUrl || config.assets.defaultTrackArtwork,
					icon: "⏭️"
				});
				return this._reply(context, container);
			} else {
				const container = buildContainer({
					title: "Track Skipped",
					content: `Skipped **${skippedTrack?.info?.title || 'track'}**. Queue has ended.`,
					thumbnail: skippedTrack?.info?.artworkUrl || config.assets.defaultTrackArtwork,
					icon: "⏹️"
				});
				return this._reply(context, container);
			}
		}

		const newCurrentTrack = pm.queue.tracks[amount - 1];
		await pm.skip(amount);

		const container = this._createSuccessContainer(
			skippedTrack,
			newCurrentTrack,
			amount,
		);
		const hasQueue = pm.queueSize > 0;

		if (hasQueue) {
			container.addSeparatorComponents(
				new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
			);
			container.addActionRowComponents(this._createSkipToMenu(pm));
		}

		const message = await this._reply(context, container);
		if (message && hasQueue) {
			this._setupCollector(message, client, pm.guildId);
		}
	}

	_createSuccessContainer(skipped: any, current: any, amount: number) {
		let content =
			`**Skipped Track Information**\n\n` +
			`└─ **${emoji.get("info")} Title:** ${skipped.info.title}\n` +
			`└─ **${emoji.get("folder")} Artist:** ${skipped.info.author || "Unknown"}\n` +
			`└─ **${emoji.get("check")} Duration:** ${this._formatDuration(skipped.info.duration)}\n` +
			`└─ **${emoji.get("reset")} Status:** Successfully skipped\n\n` +
			`*Track has been skipped from queue*\n\n`;

		if (current) {
			content +=
				`**Now Playing**\n\n` +
				`└─ **${emoji.get("music")} Title:** ${current.info.title}\n` +
				`└─ **${emoji.get("folder")} Artist:** ${current.info.author || "Unknown"}\n` +
				`└─ **${emoji.get("info")} Duration:** ${this._formatDuration(current.info.duration)}\n` +
				`└─ **${emoji.get("check")} Status:** Currently playing\n\n` +
				`*Now streaming in voice channel*`;
		}

		return buildContainer({
			title: amount === 1 ? "Track Skipped" : `Skipped ${amount} Tracks`,
			content,
			thumbnail: (current || skipped).info.artworkUrl || config.assets.defaultTrackArtwork,
			icon: emoji.get("music") || "⏭️"
		});
	}

	_createSkipToMenu(pm: PlayerManager) {
		const options = pm.queue.tracks.slice(0, 25).map((track, index) => ({
			label: track.info.title.substring(0, 100),
			description: `by ${track.info.author || "Unknown"}`.substring(0, 100),
			value: `${index}`,
		}));

		return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(`skip_to_track_${pm.guildId}`)
				.setPlaceholder("Or skip directly to another track...")
				.addOptions(options),
		);
	}

	async _setupCollector(message: Message, client: any, guildId: any) {
		const filter = (i: any) => i.customId === `skip_to_track_${guildId}`;
		const collector = message.createMessageComponentCollector({
			filter,
			time: 60_000,
			max: 1,
		});

		collector.on("collect", async (interaction: any) => {
			await interaction.deferUpdate();
			const player = client.music?.getPlayer(guildId);

			if (!player || !player.playing) {
				return interaction.editReply({
					content: "The player is no longer active.",
					components: [],
				});
			}

			const pm = new PlayerManager(player);
			const trackIndex = parseInt(interaction.values[0], 10);

			if (trackIndex >= pm.queueSize) {
				return interaction.editReply({
					content: "This track is no longer in the queue.",
					components: [],
				});
			}

			const targetTrack = pm.queue.tracks[trackIndex];
			await pm.skip(trackIndex + 1);

			const content =
				`**Now Playing**\n\n` +
				`└─ **${emoji.get("music")} Title:** ${targetTrack.info.title}\n` +
				`└─ **${emoji.get("folder")} Artist:** ${targetTrack.info.author || "Unknown"}\n` +
				`└─ **${emoji.get("info")} Duration:** ${this._formatDuration(targetTrack.info.duration)}\n` +
				`└─ **${emoji.get("check")} Status:** Successfully skipped to track\n\n` +
				`*Now streaming in voice channel*`;

			const container = buildContainer({
				title: "Skipped to Track",
				content,
				thumbnail: targetTrack.info.artworkUrl || config.assets.defaultTrackArtwork,
				icon: emoji.get("music") || "⏭️"
			});

			await interaction.editReply({ components: [container], content: "" });
		});

		collector.on("end", async (collected: any, reason: any) => {
			if (reason === "limit" || reason === "messageDelete") return;

			try {
				const currentMessage = await this._fetchMessage(message).catch(
					() => null,
				);

				if (!currentMessage?.components?.length) {
					return;
				}

				const success = await this._disableAllComponents(currentMessage);

				if (success) {
					logger.debug(
						"SkipCommand",
						`Components disabled successfully. Reason: ${reason}`,
					);
				}
			} catch (error: any) {
				this._handleDisableError(error, reason);
			}
		});

		collector.on("dispose", async (interaction: any) => {
			logger.debug(
				"SkipCommand",
				`Interaction disposed: ${interaction.customId}`,
			);
		});
	}

	async _disableAllComponents(message: Message) {
		try {
			const disabledComponents = this._processComponents(message.components);

			await message.edit({
				components: disabledComponents,
				flags: MessageFlags.IsComponentsV2,
			});

			return true;
		} catch (error: any) {
			logger.error(
				"SkipCommand",
				`Failed to disable components: ${error.message}`,
				error,
			);
			return false;
		}
	}

	_processComponents(components: any) {
		return components.map((component: any) => {
			if (component.type === ComponentType.ActionRow) {
				return {
					...component.toJSON(),
					components: component.components.map((subComponent: any) => ({
						...subComponent.toJSON(),
						disabled: true,
					})),
				};
			}

			if (component.type === ComponentType.Container) {
				return {
					...component.toJSON(),
					components: this._processComponents(component.components),
				};
			}

			if (component.type === ComponentType.Section) {
				const processedComponent = {
					...component.toJSON(),
					components: this._processComponents(component.components),
				};

				if (
					component.accessory &&
					component.accessory.type === ComponentType.Button
				) {
					processedComponent.accessory = {
						...component.accessory.toJSON(),
						disabled: true,
					};
				}

				return processedComponent;
			}

			return component.toJSON();
		});
	}

	_handleDisableError(error: any, reason: any) {
		if (error.code === 10008) {
			logger.debug(
				"SkipCommand",
				`Message was deleted, cannot disable components. Reason: ${reason}`,
			);
		} else if (error.code === 50001) {
			logger.warn(
				"SkipCommand",
				`Missing permissions to edit message. Reason: ${reason}`,
			);
		} else {
			logger.error(
				"SkipCommand",
				`Error disabling components: ${error.message}. Reason: ${reason}`,
				error,
			);
		}
	}

	async _fetchMessage(messageOrInteraction: any) {
		if (messageOrInteraction.fetchReply) {
			return await messageOrInteraction.fetchReply();
		} else if (messageOrInteraction.fetch) {
			return await messageOrInteraction.fetch();
		} else {
			return messageOrInteraction;
		}
	}

	_shouldDisableComponent(component: any) {
		const selectMenuTypes = [
			StringSelectMenuBuilder,
			UserSelectMenuBuilder,
			RoleSelectMenuBuilder,
			ChannelSelectMenuBuilder,
			MentionableSelectMenuBuilder,
		];

		if (selectMenuTypes.some((type) => component instanceof type)) {
			return true;
		}

		if (component instanceof ButtonBuilder) {
			return component.data.style !== ButtonStyle.Link;
		}

		return false;
	}

	_formatDuration(ms: any) {
		if (!ms || ms < 0) return "Live";
		const seconds = Math.floor((ms / 1000) % 60)
			.toString()
			.padStart(2, "0");
		const minutes = Math.floor((ms / (1000 * 60)) % 60)
			.toString()
			.padStart(2, "0");
		const hours = Math.floor(ms / (1000 * 60 * 60));
		if (hours > 0) return `${hours}:${minutes}:${seconds}`;
		return `${minutes}:${seconds}`;
	}

	_createErrorContainer(message: string) {
		return buildError(message);
	}

	async _reply(context: CommandContext, container: any) {
		const payload = {
			components: [container],
			flags: MessageFlags.IsComponentsV2,
			fetchReply: true,
		};
		if (context.editReply && (context.deferred || context.replied)) {
			return await context.editReply(payload);
		}
		const send = context.deferred || context.replied ? context.editReply!.bind(context) : context.reply!.bind(context);
		return await (send as (p: any) => any)(payload);
	}
}

export default new SkipCommand();