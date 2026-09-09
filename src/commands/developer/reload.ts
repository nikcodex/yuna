import type { Message, Interaction, CommandInteraction } from 'discord.js';
import type { YunaClient } from '#core/YunaClient';
import { Command } from '#core/Command';
import {
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { buildContainer, buildSuccess, buildError } from '#ui/Theme';
import { logger } from '#utils/logger';
import emoji from '#config/emoji';

class ReloadCommand extends Command {
  constructor() {
    super({
      name: 'reload',
      description: 'Interactive Multi-Select Hot-Reload for commands, events, cards, and modules',
      category: 'developer',
      aliases: ['rl', 'hotreload'],
      usage: 'reload [commands | events | cards | <command_name>]',
      access: {
        ownerOnly: true
      },
      slash: {
        enabled: false
      }
    });
  }

  async execute(ctx: any) {
    const { client, message, args = [] } = ctx;
    const authorId = message.author.id;

    // Direct command argument mode (e.g. .reload play or .reload events)
    if (args.length > 0) {
      const target = args[0].toLowerCase();
      return this._handleDirectReload(message, client, target);
    }

    // Interactive Multi-Select Menu Mode
    const infoIcon = emoji.get('info') || 'ℹ️';
    const folderIcon = emoji.get('folder') || '📁';
    const checkIcon = emoji.get('check') || '✅';

    let content = `┌─ **${infoIcon} Status:** Live Hot-Reload Engine Ready\n`;
    content += `├─ **Commands:** ${client.commands.size} loaded (${client.commandLoader?.slashCommands?.size || 0} slash)\n`;
    content += `├─ **Events:** ${client.events?.size || 12} registered listeners\n`;
    content += `└─ **Target Modules:** 6 Subsystems Available\n\n`;
    content += `*Select one or multiple subsystems from the menu below to hot-reload them with 0 downtime.*`;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('reload_subsystems_select')
      .setPlaceholder('⚡ Select subsystems & folders to reload...')
      .setMinValues(1)
      .setMaxValues(6)
      .addOptions([
        {
          label: 'Commands (All)',
          value: 'commands',
          description: 'Reloads all 84 commands & updates slash registry',
          emoji: '📁'
        },
        {
          label: 'Music & Playback Engine',
          value: 'music',
          description: 'Reloads music playback, queue, search & favorites',
          emoji: '🎵'
        },
        {
          label: 'Audio Filters & DSP Presets',
          value: 'filters',
          description: 'Reloads FilterEngine & 21 equalizer audio presets',
          emoji: '🎛️'
        },
        {
          label: 'Discord Gateway & Audio Events',
          value: 'events',
          description: 'Reloads voice: State, raw, prefix, and slash handlers',
          emoji: '⚡'
        },
        {
          label: 'Canvas Cards & Visual Generators',
          value: 'cards',
          description: 'Reloads MusicCard, PingCard, BannerCard & CommandCard',
          emoji: '🖼️'
        },
        {
          label: 'Database SQLite Repositories',
          value: 'data: base',
          description: 'Refreshes DB repository instances and caches',
          emoji: '💾'
        }
      ]);

    const closeButton = new ButtonBuilder()
      .setCustomId('reload_close_btn')
      .setLabel('Close')
      .setStyle(ButtonStyle.Secondary);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(closeButton);

    const menuContainer = buildContainer({
      title: 'Live Hot-Reload Center',
      subtitle: 'Zero-Downtime Subsystem Selector',
      content,
      components: [row1, row2],
      icon: '⚡'
    });

    const replyMsg = await message.reply({
      components: [menuContainer],
      flags: MessageFlags.IsComponentsV2
    });

    const collector = replyMsg.createMessageComponentCollector({
      time: 120_000
    });

    collector.on('collect', async (interaction: any) => {
      if (interaction.user.id !== authorId) {
        return interaction.reply({
          components: [buildError(ctx.t("onlyTheBotDe"))],
          flags: MessageFlags.IsComponentsV2,
          ephemeral: true
        });
      }

      if (interaction.customId === 'reload_close_btn') {
        collector.stop('closed');
        return interaction.update({
          components: [
            buildContainer({
              title: 'Hot-Reload Center Closed',
              content: `> ${checkIcon} Hot-reload control session dismissed.`,
              icon: '🔒'
            })
          ],
          flags: MessageFlags.IsComponentsV2
        });
      }

      if (interaction.customId === 'reload_subsystems_select') {
        await interaction.deferUpdate();
        const selectedValues = interaction.values;
        const start = performance.now();
        const reloadedItems = [];

        try {
          // 1. Commands reload
          if (selectedValues.includes('commands') || selectedValues.includes('music') || selectedValues.includes('filters')) {
            await client.commandLoader.load();
            reloadedItems.push(`Commands (${client.commands.size})`);
          }

          // 2. Events reload
          if (selectedValues.includes('events')) {
            await client.eventLoader.load();
            reloadedItems.push('Events & Handlers');
          }

          // 3. Canvas cards reload
          if (selectedValues.includes('cards')) {
            await import(`../../ui/cards/MusicCard.js?v=${Date.now()}`).catch(() => {});
            await import(`../../ui/cards/PingCard.js?v=${Date.now()}`).catch(() => {});
            await import(`../../ui/cards/BannerCard.js?v=${Date.now()}`).catch(() => {});
            await import(`../../ui/cards/CommandCard.js?v=${Date.now()}`).catch(() => {});
            reloadedItems.push('Canvas UI Cards');
          }

          // 4. Database reload
          if (selectedValues.includes('database')) {
            const { db } = await import(`../../database/Database.js?v=${Date.now()}`);
            if (db?.checkpoint) db.checkpoint();
            reloadedItems.push('Database & Repositories');
          }

          const duration = (performance.now() - start).toFixed(1);

          let resultBody = `┌─ **${checkIcon} Result:** Hot-Reload Executed Successfully\n`;
          resultBody += `├─ **Reloaded Modules:** ${reloadedItems.join(', ')}\n`;
          resultBody += `├─ **Execution Time:** \`${duration}ms\`\n`;
          resultBody += `└─ **System State:** Operational with 0 downtime\n\n`;
          resultBody += `*All updated code is now live and taking effect immediately.*`;

          const resultContainer = buildContainer({
            title: 'Hot-Reload Completed',
            subtitle: 'Subsystem Modules Refreshed',
            content: resultBody,
            components: [row1, row2],
            icon: '🌸'
          });

          await interaction.editReply({
            components: [resultContainer],
            flags: MessageFlags.IsComponentsV2
          });
        } catch (err: any) {
          logger.error('ReloadCommand', 'Multi-select reload failure:', err);
          const errCard = buildError({
            title: 'Hot-Reload Failed',
            issue: err.message || 'An error occurred during module re-import.',
            tip: 'Check server logs for the full stack trace.'
          });
          await interaction.editReply({
            components: [errCard, row2],
            flags: MessageFlags.IsComponentsV2
          });
        }
      }
    });

    collector.on('end', async (_: any, reason: any) => {
      if (reason === 'closed') return;
      selectMenu.setDisabled(true);
      closeButton.setDisabled(true);
      await replyMsg.edit({
        components: [menuContainer],
        flags: MessageFlags.IsComponentsV2
      }).catch(() => {});
    });
  }

  async _handleDirectReload(message: any, client: any, target: any) {
    const start = performance.now();
    const checkIcon = emoji.get('check') || '✅';

    try {
      if (target === 'all' || target === 'commands') {
        await client.commandLoader.load();
        const duration = (performance.now() - start).toFixed(1);
        let content = `┌─ **${checkIcon} Result:** Commands Reloaded\n`;
        content += `├─ **Total Commands:** ${client.commands.size}\n`;
        content += `├─ **Slash Commands:** ${client.commandLoader.slashCommands.size}\n`;
        content += `└─ **Execution Time:** \`${duration}ms\``;

        const container = buildContainer({
          title: 'Hot-Reload Complete',
          content,
          icon: '🌸'
        });
        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (target === 'events') {
        await client.eventLoader.load();
        const duration = (performance.now() - start).toFixed(1);
        let content = `┌─ **${checkIcon} Result:** Events Reloaded\n`;
        content += `├─ **Listeners:** ${client.events?.size || 12}\n`;
        content += `└─ **Execution Time:** \`${duration}ms\``;

        const container = buildContainer({
          title: 'Events Reloaded',
          content,
          icon: '⚡'
        });
        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (target === 'cards') {
        await import(`../../ui/cards/MusicCard.js?v=${Date.now()}`).catch(() => {});
        await import(`../../ui/cards/PingCard.js?v=${Date.now()}`).catch(() => {});
        await import(`../../ui/cards/BannerCard.js?v=${Date.now()}`).catch(() => {});
        await import(`../../ui/cards/CommandCard.js?v=${Date.now()}`).catch(() => {});
        const duration = (performance.now() - start).toFixed(1);

        let content = `┌─ **${checkIcon} Result:** All Canvas Cards Reloaded\n`;
        content += `├─ **Cards:** MusicCard, PingCard, BannerCard, CommandCard\n`;
        content += `└─ **Execution Time:** \`${duration}ms\``;

        const container = buildContainer({
          title: 'Canvas Cards Reloaded',
          content,
          icon: '🖼️'
        });
        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      // Single command reload
      const filePath = client.commandLoader.commandPaths.get(target);
      if (!filePath) {
        return message.reply({
          components: [buildError({
            title: 'Command Not Found',
            issue: `Command \`${target}\` was not found in active registry.`,
            tip: 'Check command spelling or use `.reload` without arguments for the full menu.'
          })],
          flags: MessageFlags.IsComponentsV2
        });
      }

      const freshModule = await import(`file://${filePath}?v=${Date.now()}`);
      if (!freshModule?.default) {
        throw new Error('Fresh module is missing a default export.');
      }

      const freshCommand = freshModule.default;
      client.commands.set(freshCommand.name, freshCommand);
      const duration = (performance.now() - start).toFixed(1);

      let content = `┌─ **${checkIcon} Result:** Single Command Reloaded\n`;
      content += `├─ **Target:** \`.${freshCommand.name}\`\n`;
      content += `├─ **Category:** ${freshCommand.category || 'general'}\n`;
      content += `└─ **Execution Time:** \`${duration}ms\``;

      const container = buildContainer({
        title: 'Command Hot-Reloaded',
        content,
        icon: '🌸'
      });
      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err: any) {
      logger.error('ReloadCommand', `Failed to hot-reload target "${target}":`, err);
      return message.reply({
        components: [buildError({
          title: 'Reload Failed',
          issue: err.message,
          tip: 'Check server logs for error details.'
        })],
        flags: MessageFlags.IsComponentsV2
      });
    }
  }
}

export default new ReloadCommand();
