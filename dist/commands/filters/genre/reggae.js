import { MessageFlags } from "discord.js";
import phrases from "#utils/phrases";
import { buildContainer, buildError } from "#ui/Theme";
import { config } from "#config/config";
import { Command } from '#core/Command';
import emoji from "#config/emoji";
class ReggaeFilterCommand extends Command {
    constructor() {
        super({
            name: "reggae",
            description: "Apply reggae equalizer preset to the music",
            usage: "reggae",
            aliases: [],
            category: "music",
            examples: ["reggae"],
            cooldown: 2,
            voiceRequired: true,
            sameVoiceRequired: true,
            playerRequired: true,
            playingRequired: true,
            enabledSlash: true,
            slashData: {
                name: ["filter", "reggae"],
                description: "Apply reggae equalizer preset to the music",
            },
        });
    }
    async execute({ message: Message, pm }) {
        // @ts-ignore
        return this._handleFilter(message, pm);
    }
    async slashExecute({ interaction: CommandInteraction, pm }) {
        // @ts-ignore
        return this._handleFilter(interaction, pm);
    }
    // @ts-ignore
    async _handleFilter(context, pm) {
        try {
            await pm.player.filterManager.setEQ([
                {
                    band: 0,
                    gain: 0
                },
                {
                    band: 1,
                    gain: 0
                },
                {
                    band: 2,
                    gain: 0
                },
                {
                    band: 3,
                    gain: -0.5
                },
                {
                    band: 4,
                    gain: -0.1
                },
                {
                    band: 5,
                    gain: 0.2
                },
                {
                    band: 6,
                    gain: 0.3
                },
                {
                    band: 7,
                    gain: 0
                },
                {
                    band: 8,
                    gain: 0
                },
                {
                    band: 9,
                    gain: 0
                },
                {
                    band: 10,
                    gain: 0
                },
                {
                    band: 11,
                    gain: 0
                },
                {
                    band: 12,
                    gain: 0
                },
                {
                    band: 13,
                    gain: 0
                }
            ]);
            return this._reply(context, this._createSuccessContainer("Reggae"));
        }
        catch (error) {
            return this._reply(context, this._createErrorContainer("Could not apply the reggae filter."));
        }
    }
    _createSuccessContainer(filterName) {
        const content = `**Filter Information**\n\n` +
            `└─ **${emoji.get("music")} Filter:** ${filterName} Equalizer\n` +
            `└─ **${emoji.get("check")} Status:** Applied successfully\n` +
            `└─ **${emoji.get("info")} Effect:** Enhanced for reggae music\n\n` +
            `*${phrases.get("filterApplied")}*`;
        return buildContainer({
            title: "Filter Applied",
            content: content,
            thumbnail: config.assets?.defaultThumbnail || config.assets?.defaultTrackArtwork,
            icon: emoji.get("music") || "ℹ️"
        });
    }
    // @ts-ignore
    _createErrorContainer(message) {
        return buildError(message, "Error");
    }
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
        // @ts-ignore
        if (context.editReply && (context.deferred || context.replied)) {
            // @ts-ignore
            return await context.editReply(payload);
        }
        // @ts-ignore
        if (context.reply) {
            // @ts-ignore
            return await context.reply(payload);
        }
        return context.channel.send(payload);
    }
}
export default new ReggaeFilterCommand();
