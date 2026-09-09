import { MessageFlags } from "discord.js";
import phrases from "#utils/phrases";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";

import { config } from "#config/config";
import { Command, CommandContext } from '#core/Command';
import emoji from "#config/emoji";
import { PlayerManager } from "#audio/PlayerManager";

class VocalsFilterCommand extends Command {
	constructor() {
		super({
			name: "vocals",
			description: "Apply vocals equalizer preset to the music",
			usage: "vocals",
			aliases: [],
			category: "music",
			examples: ["vocals"],
			cooldown: 2,
			voiceRequired: true,
			sameVoiceRequired: true,
			playerRequired: true,
			playingRequired: true,
			enabledSlash: true,
			slashData: {
				name: ["filter", "vocals"],
				description: "Apply vocals equalizer preset to the music",
			},
		});
	}

	async execute({ message, pm }: any) {
		return this._handleFilter(message, pm);
	}

	async slashExecute({ interaction, pm }: any) {
		return this._handleFilter(interaction, pm);
	}

	async _handleFilter(context: CommandContext, pm: PlayerManager) {
		try {
			await pm.player.filterManager.setEQ([
   {
      band: 0,
      gain: -0.2
   },
   {
      band: 1,
      gain: -0.3
   },
   {
      band: 2,
      gain: -0.3
   },
   {
      band: 3,
      gain: 0.1
   },
   {
      band: 4,
      gain: 0.9
   },
   {
      band: 5,
      gain: 0.9
   },
   {
      band: 6,
      gain: 0.5
   },
   {
      band: 7,
      gain: 0.2
   },
   {
      band: 8,
      gain: -0.1
   },
   {
      band: 9,
      gain: -0.2
   },
   {
      band: 10,
      gain: -0.3
   },
   {
      band: 11,
      gain: 0
   },
   {
      band: 12,
      gain: 0.4
   },
   {
      band: 13,
      gain: 0.6
   }
]);

			return this._reply(context, this._createSuccessContainer("Vocals"));
		} catch (error) {
			return this._reply(
				context,
				this._createErrorContainer("Could not apply the vocals filter."),
			);
		}
	}

	_createSuccessContainer(filterName: any) {
		const content =
			`**Filter Information**\n\n` +
			`└─ **${emoji.get("music")} Filter:** ${filterName} Equalizer\n` +
			`└─ **${emoji.get("check")} Status:** Applied successfully\n` +
			`└─ **${emoji.get("info")} Effect:** Enhanced for vocals music\n\n` +
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
			return await context.editReply(payload);
		}
		if (context.reply) {
			return await context.reply(payload);
		}
		return context.channel.send(payload);
	}
}

export default new VocalsFilterCommand();