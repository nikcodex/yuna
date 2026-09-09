import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { Command } from '#core/Command';
import { FilterEngine } from '#audio/FilterEngine';
import { buildContainer, buildError } from '#ui/Theme';
import emoji from '#config/emoji';
class FilterCommand extends Command {
    constructor() {
        super({
            name: 'filter',
            description: 'Manage audio filters for the current player',
            usage: 'filter <apply|reset|list>',
            category: 'music',
            access: {
                voice: true,
                sameVoice: true,
                player: true,
                playing: true
            },
            slash: {
                enabled: true,
                autoDefer: true,
                data: {
                    name: 'filter',
                    description: 'Manage audio filters for the current player',
                    options: [
                        {
                            name: 'apply',
                            description: 'Apply a specific filter preset',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    name: 'preset',
                                    description: 'The filter preset to apply',
                                    type: ApplicationCommandOptionType.String,
                                    required: true,
                                    autocomplete: true
                                }
                            ]
                        },
                        {
                            name: 'reset',
                            description: 'Reset all active filters',
                            type: ApplicationCommandOptionType.Subcommand
                        },
                        {
                            name: 'list',
                            description: 'List all available filter presets',
                            type: ApplicationCommandOptionType.Subcommand
                        }
                    ]
                }
            }
        });
    }
    async autocomplete({ interaction }) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const presets = FilterEngine.getPresetNames();
        const filtered = presets.filter(p => p.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filtered.map(preset => ({ name: preset, value: preset })));
    }
    async execute(ctx) {
        const { client, message, interaction, player, pm, args = [] } = ctx;
        const context = interaction || message;
        const targetPlayer = pm?.player || player || client?.music?.getPlayer(context.guildId || context.guild?.id);
        let subcommand = 'list';
        let presetName = null;
        if (interaction) {
            subcommand = interaction.options.getSubcommand();
            if (subcommand === 'apply') {
                presetName = interaction.options.getString('preset');
            }
        }
        else {
            const firstArg = args[0]?.toLowerCase();
            if (firstArg === 'reset') {
                subcommand = 'reset';
            }
            else if (firstArg === 'list') {
                subcommand = 'list';
            }
            else if (firstArg === 'apply' && args[1]) {
                subcommand = 'apply';
                presetName = args[1];
            }
            else if (firstArg && FilterEngine.getPresetInfo(firstArg)) {
                subcommand = 'apply';
                presetName = firstArg;
            }
            else if (firstArg) {
                subcommand = 'apply';
                presetName = firstArg;
            }
            else {
                subcommand = 'list';
            }
        }
        if (subcommand === 'apply') {
            const info = FilterEngine.getPresetInfo(presetName);
            if (!info) {
                return this._reply(context, buildError(ctx.t("invalidPreset"), 'Error'));
            }
            const success = await FilterEngine.apply(targetPlayer, presetName);
            if (success) {
                const container = buildContainer({
                    title: 'Filter Applied',
                    content: `**${presetName}** filter has been applied to the player.\n\n` +
                        `└─ **${emoji.get('music') || '🎵'} Effect:** ${info.description}`,
                    icon: emoji.get('check') || '✅'
                });
                return this._reply(context, container);
            }
            else {
                return this._reply(context, buildError(ctx.t("failedToApply"), 'Error'));
            }
        }
        else if (subcommand === 'reset') {
            const success = await FilterEngine.reset(targetPlayer);
            if (success) {
                const container = buildContainer({
                    title: 'Filters Reset',
                    content: `All audio filters have been cleared.\n\n` +
                        `└─ **${emoji.get('music') || '🎵'} Effect:** Audio back to original quality`,
                    icon: emoji.get('check') || '✅'
                });
                return this._reply(context, container);
            }
            else {
                return this._reply(context, buildError(ctx.t("failedToReset"), 'Error'));
            }
        }
        else if (subcommand === 'list') {
            const presets = FilterEngine.getPresetNames();
            const list = presets.map(p => `\`${p}\``).join(', ');
            const container = buildContainer({
                title: 'Available Filters',
                content: `Here are the available filter presets:\n\n${list}`,
                icon: emoji.get('music') || '🎵'
            });
            return this._reply(context, container);
        }
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    async _reply(context, container) {
        const payload = {
            components: [container],
            flags: MessageFlags.IsComponentsV2
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
export default new FilterCommand();
