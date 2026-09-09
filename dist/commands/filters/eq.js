import { MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { buildError, buildSuccess } from "#ui/Theme";
import { config } from "#config/config";
import { Command } from '#core/Command';
import { logger } from "#utils/logger";
import phrases from "#utils/phrases";
import { PlayerManager } from "#audio/PlayerManager";
const EQ_PRESETS = {
    flat: {
        name: "Flat (Default)",
        description: "Standard balanced audio output without equalizer boost",
        bands: Array.from({ length: 15 }, (_, i) => ({ band: i, gain: 0.0 })),
    },
    bass_light: {
        name: "Bass Boost (Light)",
        description: "Subtle low-end bass enhancement (+2dB)",
        bands: [
            { band: 0, gain: 0.2 },
            { band: 1, gain: 0.15 },
            { band: 2, gain: 0.1 },
        ],
    },
    bass_medium: {
        name: "Bass Boost (Medium)",
        description: "Balanced deep bass punch (+5dB)",
        bands: [
            { band: 0, gain: 0.5 },
            { band: 1, gain: 0.4 },
            { band: 2, gain: 0.25 },
            { band: 3, gain: 0.15 },
        ],
    },
    bass_extreme: {
        name: "Bass Boost (Extreme)",
        description: "Heavy sub-woofer bass blast (+9dB)",
        bands: [
            { band: 0, gain: 0.85 },
            { band: 1, gain: 0.7 },
            { band: 2, gain: 0.5 },
            { band: 3, gain: 0.3 },
        ],
    },
    treble: {
        name: "Treble Booster",
        description: "Enhances high frequencies for crisp vocals and cymbals",
        bands: [
            { band: 10, gain: 0.25 },
            { band: 11, gain: 0.35 },
            { band: 12, gain: 0.45 },
            { band: 13, gain: 0.5 },
            { band: 14, gain: 0.55 },
        ],
    },
    vocal: {
        name: "Vocal Clarity",
        description: "Brings forward mid-range frequencies for clear singing voices",
        bands: [
            { band: 3, gain: 0.1 },
            { band: 4, gain: 0.35 },
            { band: 5, gain: 0.45 },
            { band: 6, gain: 0.4 },
            { band: 7, gain: 0.25 },
        ],
    },
    club: {
        name: "Deep Club / Party",
        description: "V-shaped sound profile with boosted bass & treble",
        bands: [
            { band: 0, gain: 0.5 },
            { band: 1, gain: 0.4 },
            { band: 2, gain: 0.2 },
            { band: 11, gain: 0.3 },
            { band: 12, gain: 0.4 },
            { band: 13, gain: 0.5 },
        ],
    },
    acoustic: {
        name: "Acoustic / Live",
        description: "Warm mid-range emphasis for acoustic instruments",
        bands: [
            { band: 2, gain: 0.15 },
            { band: 3, gain: 0.25 },
            { band: 4, gain: 0.3 },
            { band: 5, gain: 0.25 },
            { band: 6, gain: 0.15 },
        ],
    },
};
class EqualizerCommand extends Command {
    constructor() {
        super({
            name: "eq",
            description: "Fine-tune 15-band audio equalizer settings and presets",
            usage: "eq [preset]",
            aliases: ["equalizer", "eqs"],
            category: "filters",
            examples: ["eq", "eq bass_medium", "eq treble"],
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
                    name: "eq",
                    description: "Fine-tune 15-band audio equalizer settings and presets",
                    options: [
                        {
                            name: "preset",
                            description: "Select an equalizer preset",
                            type: 3,
                            required: false,
                            choices: Object.entries(EQ_PRESETS).map(([key, data]) => ({
                                name: data.name,
                                value: key,
                            })),
                        },
                    ],
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
        const presetKey = interaction ? interaction.options.getString("preset") : args[0]?.toLowerCase();
        // @ts-ignore
        if (presetKey && EQ_PRESETS[presetKey]) {
            return this._applyPreset(context, activePm, presetKey);
        }
        return this._sendEQMenu(context, activePm);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    async _sendEQMenu(context, pm) {
        const button = new ButtonBuilder()
            .setLabel("Support")
            .setURL(config.links?.supportServer || "https://discord.gg/XYwwyDKhec")
            .setStyle(ButtonStyle.Link);
        let desc = `Select a custom equalizer profile below to sculpt your server's audio experience in real-time!\n\n`;
        Object.entries(EQ_PRESETS).forEach(([key, data]) => {
            desc += `🎚️ **${data.name}**\n${data.description}\n\`Command: .eq ${key}\`\n\n`;
        });
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🎛️ 15-Band Graphic Equalizer`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc.trim()))
            .setButtonAccessory(button));
        const selectOptions = Object.entries(EQ_PRESETS).map(([key, data]) => ({
            label: data.name,
            description: data.description.substring(0, 100),
            value: key,
            emoji: "🎚️",
        }));
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId("eq_select_preset")
            .setPlaceholder("Choose Equalizer Preset...")
            .addOptions(selectOptions));
        // @ts-ignore
        container.addActionRowComponents(row);
        const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
        // @ts-ignore
        const msg = context.reply
            // @ts-ignore
            ? await context.reply({ ...payload, fetchReply: true })
            : await context.channel.send(payload);
        if (msg) {
            // @ts-ignore
            const userId = context.author?.id || context.user?.id;
            // @ts-ignore
            const filter = (i) => i.customId === "eq_select_preset" && i.user.id === userId;
            const collector = msg.createMessageComponentCollector({ filter, time: 60000 });
            // @ts-ignore
            collector.on("collect", async (i) => {
                const selectedKey = i.values[0];
                await i.deferUpdate();
                await this._applyPreset(i, pm, selectedKey, msg);
            });
        }
    }
    // @ts-ignore
    async _applyPreset(context, pm, presetKey, existingMsg = null) {
        try {
            // @ts-ignore
            const preset = EQ_PRESETS[presetKey];
            if (!preset)
                return;
            await pm.player.filterManager.setEQ(preset.bands);
            const note = phrases.get("filterApplied");
            const container = buildSuccess(`Successfully set audio equalizer to **${preset.name}**!\n\n*${preset.description}*\n*${note}*`, "Equalizer Profile Applied");
            const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
            // @ts-ignore
            if (existingMsg && existingMsg.edit) {
                // @ts-ignore
                await existingMsg.edit(payload);
                // @ts-ignore
            }
            else if (context.reply && (context.replied || context.deferred)) {
                // @ts-ignore
                await context.editReply(payload);
                // @ts-ignore
            }
            else if (context.reply) {
                // @ts-ignore
                await context.reply(payload);
            }
            else {
                await context.channel.send(payload);
            }
        }
        catch (err) {
            logger.error("EqualizerCommand", "Error applying equalizer preset:", err);
            const errorContainer = buildError(phrases.get("errorGeneric"), "Equalizer Error");
            const payload = { components: [errorContainer], flags: MessageFlags.IsComponentsV2 };
            // @ts-ignore
            if (context.reply && (context.replied || context.deferred)) {
                // @ts-ignore
                await context.editReply(payload);
                // @ts-ignore
            }
            else if (context.reply) {
                // @ts-ignore
                await context.reply(payload);
            }
            else {
                await context.channel.send(payload);
            }
        }
    }
}
export default new EqualizerCommand();
