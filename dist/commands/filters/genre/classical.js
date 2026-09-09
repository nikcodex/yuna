import { MessageFlags } from "discord.js";
import phrases from "#utils/phrases";
import { buildContainer, buildError } from "#ui/Theme";
import { config } from "#config/config";
import { Command } from '#core/Command';
import emoji from "#config/emoji";
import { PlayerManager } from "#audio/PlayerManager";
class ClassicalFilterCommand extends Command {
    constructor() {
        super({
            name: "classical",
            description: "Apply classical equalizer preset to the music",
            usage: "classical",
            aliases: [],
            category: "music",
            examples: ["classical"],
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
                    name: "classical",
                    description: "Apply classical equalizer preset to the music",
                },
            },
        });
    }
    async execute(ctx) {
        const { client, message, interaction, player, pm, args = [] } = ctx;
        const context = interaction || message;
        const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
        if (!activePm)
            return;
        return this._handleFilter(context, activePm);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
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
                    gain: 0
                },
                {
                    band: 4,
                    gain: 0
                },
                {
                    band: 5,
                    gain: 0
                },
                {
                    band: 6,
                    gain: -0.7
                },
                {
                    band: 7,
                    gain: -0.7
                },
                {
                    band: 8,
                    gain: -0.7
                },
                {
                    band: 9,
                    gain: -0.9
                },
                {
                    band: 10,
                    gain: -0.1
                },
                {
                    band: 11,
                    gain: -0.1
                },
                {
                    band: 12,
                    gain: 0
                },
                {
                    band: 13,
                    gain: -0.2
                }
            ]);
            return this._reply(context, this._createSuccessContainer("Classical"));
        }
        catch (error) {
            return this._reply(context, this._createErrorContainer("Could not apply the classical filter."));
        }
    }
    _createSuccessContainer(filterName) {
        const content = `**Filter Information**\n\n` +
            `└─ **${emoji.get("music")} Filter:** ${filterName} Equalizer\n` +
            `└─ **${emoji.get("check")} Status:** Applied successfully\n` +
            `└─ **${emoji.get("info")} Effect:** Enhanced for classical music\n\n` +
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
        return await context.reply(payload);
    }
}
export default new ClassicalFilterCommand();
