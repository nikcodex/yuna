import { MessageFlags } from "discord.js";
import phrases from "#utils/phrases";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";

import { config } from "#config/config";
import { Command, CommandContext } from '#core/Command';
import emoji from "#config/emoji";
import { PlayerManager } from "#audio/PlayerManager";

class HiphopFilterCommand extends Command {
	constructor() {
		super({
			name: "hiphop",
			description: "Apply hiphop equalizer preset to the music",
			usage: "hiphop",
			aliases: [],
			category: "music",
			examples: ["hiphop"],
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
					name: "hiphop",
					description: "Apply hiphop equalizer preset to the music",
				},
			},
		});
	}

	async execute(ctx: CommandContext) {
		const { client, message, interaction, player, pm, args = [] } = ctx;
		const context = interaction || message;
		const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
		if (!activePm) return;
		return this._handleFilter(context, activePm);
	}

	async slashExecute(ctx: CommandContext) {
		return this.execute(ctx);
	}

	async _handleFilter(context: CommandContext, pm: PlayerManager) {
		try {
			await pm.player.filterManager.setEQ([
   {
      band: 0,
      gain: 0.6
   },
   {
      band: 1,
      gain: 0.5
   },
   {
      band: 2,
      gain: 0.2
   },
   {
      band: 3,
      gain: 0.3
   },
   {
      band: 4,
      gain: -0.2
   },
   {
      band: 5,
      gain: -0.1
   },
   {
      band: 6,
      gain: 0.2
   },
   {
      band: 7,
      gain: -0.1
   },
   {
      band: 8,
      gain: -0.1
   },
   {
      band: 9,
      gain: 0.1
   },
   {
      band: 10,
      gain: 0.3
   },
   {
      band: 11,
      gain: 0.4
   },
   {
      band: 12,
      gain: 0.4
   },
   {
      band: 13,
      gain: 0.2
   }
]);

			return this._reply(context, this._createSuccessContainer("Hiphop"));
		} catch (error) {
			return this._reply(
				context,
				this._createErrorContainer("Could not apply the hiphop filter."),
			);
		}
	}

	_createSuccessContainer(filterName: any) {
		const content =
			`**Filter Information**\n\n` +
			`└─ **${emoji.get("music")} Filter:** ${filterName} Equalizer\n` +
			`└─ **${emoji.get("check")} Status:** Applied successfully\n` +
			`└─ **${emoji.get("info")} Effect:** Enhanced for hiphop music\n\n` +
			`*${phrases.get("filterApplied")}*`;

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

export default new HiphopFilterCommand();