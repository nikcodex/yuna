import { InteractionType, MessageFlags } from "discord.js";
import { Middleware } from "#core/Middleware";
import { logger } from "#utils/logger";
import { localeStore } from "#utils/localeStore.js";
import { DiscordLogger } from "#utils/DiscordLogger";
import { db } from "#database/Database";
import { i18n } from "#utils/i18n.js";
import { PlayerManager } from "#audio/PlayerManager";
function getCommandFile(interaction, client) {
    const { commandName } = interaction;
    let subCommandName = null;
    try {
        subCommandName = interaction.options.getSubcommand(false);
    }
    catch (e) { }
    const key = subCommandName ? [commandName, subCommandName].toString() : commandName;
    return client.commands.get(key) || client.commands.get(commandName);
}
export default {
    name: "interactionCreate",
    async execute(interaction, client) {
        if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
            const commandToExecute = getCommandFile(interaction, client);
            if (!commandToExecute || !commandToExecute.autocomplete)
                return;
            try {
                await commandToExecute.autocomplete({ interaction, client });
            }
            catch (error) {
                logger.error("InteractionCreate", `Error handling autocomplete for '${interaction.commandName}'`, error);
            }
            return;
        }
        if (interaction.type !== InteractionType.ApplicationCommand)
            return;
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: "Commands can only be used in a server.",
                ephemeral: true,
            });
        }
        const command = getCommandFile(interaction, client);
        if (!command) {
            return interaction.reply({
                content: "This command seems to be outdated or improperly configured.",
                ephemeral: true,
            });
        }
        const player = client.music?.getPlayer(interaction.guild.id);
        const ctx = {
            interaction,
            client,
            message: null,
            args: [],
            guild: interaction.guild,
            user: interaction.user,
            member: interaction.member,
            channel: interaction.channel,
            player,
            pm: player ? new PlayerManager(player) : null,
            // @ts-ignore
            locale: db?.users?.getLocale(interaction?.user?.id) || db?.guilds?.getLocale(interaction?.guild?.id) || 'en-US',
            // @ts-ignore
            t: (category, replacements = {}) => i18n.t(db?.users?.getLocale(interaction?.user?.id) || db?.guilds?.getLocale(interaction?.guild?.id) || 'en-US', category, replacements)
        };
        try {
            const middlewareResult = await Middleware.run(ctx, command);
            if (!middlewareResult.pass) {
                const res = middlewareResult.response;
                const payload = res?.components
                    ? { components: [res], flags: MessageFlags.IsComponentsV2, ephemeral: true }
                    : (typeof res === 'object' ? { ...res, ephemeral: true } : { content: String(res), ephemeral: true });
                return interaction.reply(payload);
            }
            if (command.slash?.autoDefer) {
                const isEphemeral = !!command.access?.ownerOnly;
                await interaction.deferReply({ ephemeral: isEphemeral });
            }
            if (db.economy) {
                db.economy.addCoins(interaction.user.id, 1);
            }
            const proceed = await command.beforeExecute(ctx);
            if (!proceed) {
                const errorPayload = { content: "Command execution was cancelled.", ephemeral: true };
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errorPayload).catch(() => { });
                }
                else {
                    await interaction.reply(errorPayload).catch(() => { });
                }
                return;
            }
            await localeStore.run({ locale: ctx.locale || db?.guilds?.getLocale(ctx.guild?.id) || 'en-US' }, async () => {
                await command.execute(ctx);
            });
            await command.afterExecute(ctx);
            DiscordLogger.logCmdRun(client, { user: interaction.user, commandName: command.name, guild: interaction.guild, type: 'Slash' });
        }
        catch (error) {
            DiscordLogger.logError(client, { context: `SlashCmd:${command.name}`, error, message: `Error running slash command` });
            if (typeof command.onError === 'function') {
                await command.onError(ctx, error);
            }
            else {
                logger.error("InteractionCreate", `Error executing slash command '${command.name}'`, error);
                const errReply = { content: "An unexpected error occurred while running the command.", ephemeral: true };
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp(errReply).catch(() => { });
                }
                else {
                    await interaction.reply(errReply).catch(() => { });
                }
            }
        }
    },
};
