import { MessageFlags } from "discord.js";
import phrases from "#utils/phrases";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
import { config } from "#config/config";
import { Command, CommandContext } from '#core/Command';
import emoji from "#config/emoji";
import { PlayerManager } from "#audio/PlayerManager";

class ResetFilterCommand extends Command {
	constructor() {
		super({
			name: "reset",
			description: "Reset all audio filters to default",
			usage: "reset",
			aliases: ["clear-filter", "resetfilter"],
			category: "music",
			examples: ["reset", "clear"],
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
					name: "reset",
					description: "Reset all audio filters to default",
				},
			},
		});
	}

	async execute(ctx: CommandContext) {
		const { client, message, interaction, player, pm, args = [] } = ctx;
		const context = interaction || message;
		const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
		if (!activePm) return;
		return this._handleResetFilter(context, activePm);
	}

	async slashExecute(ctx: CommandContext) {
		return this.execute(ctx);
	}

	async _handleResetFilter(context: CommandContext, pm: PlayerManager) {
		try {
			await pm.player.filterManager.clearEQ();

			return this._reply(context, this._createSuccessContainer());
		} catch (error) {
			return this._reply(
				context,
				this._createErrorContainer("Could not reset the audio filters."),
			);
		}
	}

	_createSuccessContainer() {
		const content =
			`**Reset Information**\n\n` +
			`└─ **${emoji.get("music")} Filters:** All filters cleared\n` +
			`└─ **${emoji.get("check")} Status:** Reset successfully\n` +
			`└─ **${emoji.get("info")} Effect:** Audio back to original quality\n\n` +
			`*${phrases.get("filterCleared")}*`;

		return buildContainer({
			title: "Filter Applied",
			content: content,
			thumbnail: config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork,
			icon: emoji.get("music") || "ℹ️"
		});
	}

	_createErrorContainer(message: string) {
		return buildError(message, "Error");
	}

	async _reply(context: CommandContext, container: any) {
		const payload = {
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		};
		if (context.editReply && (context.deferred || context.replied)) {
			return await context.editReply!(payload);
		}
		return await context.reply!(payload);
	}
}
export default new ResetFilterCommand();