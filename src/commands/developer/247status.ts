import { Command, CommandContext } from '#core/Command';
import { MessageFlags } from 'discord.js';
import { db } from '#database/Database';
import { buildContainer } from '#ui/Theme';
import { isOwner } from '#core/AccessControl';

class Status247Command extends Command {
  constructor() {
    super({
      name: '247status',
      description: 'Check the status of all active 24/7 sessions across guilds',
      usage: '247status',
      aliases: ['247s'],
      category: 'developer',
      examples: ['247status'],
      cooldown: 5,
      slash: {
        enabled: true,
        autoDefer: true,
        data: {
          name: '247status',
          description: 'Developer command to check 24/7 connection health',
        },
      },
    });
  }

  async execute(ctx: CommandContext) {
    if (!isOwner((ctx as any).user?.id || (ctx as any).author?.id)) return;

    const guilds247 = db.guild.getValid247Guilds();
    if (!guilds247 || guilds247.length === 0) {
      const container = buildContainer({
        title: '24/7 Status',
        content: 'No guilds currently have 24/7 mode active.',
        icon: '📡'
      });
      return this._reply(ctx, { components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    let activeCount = 0;
    let offlineCount = 0;
    let details = '';

    for (const guildData of guilds247) {
      const player = ctx.client.music?.getPlayer(guildData.id);
      const guild = ctx.client.guilds.cache.get(guildData.id);
      const name = guild ? guild.name : `Unknown (${guildData.id})`;

      if (player && player.connected) {
        activeCount++;
        details += `🟢 **${name}**: Connected (Ch: <#${player.voiceChannelId}>)\n`;
      } else {
        offlineCount++;
        details += `🔴 **${name}**: Offline / Waiting to reconnect\n`;
      }
    }

    const content = `**Total 24/7 Guilds:** ${guilds247.length}\n` +
                    `**Active:** ${activeCount} | **Offline:** ${offlineCount}\n\n` +
                    details.substring(0, 3000);

    const container = buildContainer({
      title: '24/7 Connection Health',
      content: content,
      icon: '📡'
    });

    return this._reply(ctx, { components: [container], flags: MessageFlags.IsComponentsV2 });
  }

  async slashExecute(ctx: CommandContext) {
    return this.execute(ctx);
  }

  async _reply(context: any, payload: any) {
    if (context.editReply && (context.deferred || context.replied)) {
      return await context.editReply(payload);
    }
    return await context.reply(payload);
  }
}

export default new Status247Command();

// Made by Nikhil Under CodeX Devs
