import { Command, CommandContext } from '#core/Command';
import { db } from '#database/Database';
import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import emoji from '#config/emoji';
import { config } from '#config/config';
import { buildContainer, buildError, buildSuccess } from '#ui/Theme';
import phrases from '#utils/phrases';

class PresetCommand extends Command {
  constructor() {
    super({
      name: 'preset',
      description: 'Change your preferred Now Playing style (Card or Text).',
      usage: 'preset <card|text>',
      aliases: ['style', 'npstyle'],
      category: 'settings',
      examples: [
        'preset card',
        'preset text'
      ],
      slash: {
        enabled: true,
        data: {
          name: 'preset',
          description: 'Change your preferred Now Playing style (Card or Text).',
          options: [
            {
              name: 'style',
              description: 'The style to use for Now Playing messages.',
              type: 3,
              required: true,
              choices: [
                { name: 'Card Style', value: 'card' },
                { name: 'Text Style', value: 'text' }
              ]
            }
          ]
        }
      }
    });
  }

  async execute({ message, args }: any) {
    if (!args[0]) {
      return this.sendCurrentStyle(message, message.author.id);
    }
    const style = args[0].toLowerCase();
    await this.setStyle(message, message.author.id, style);
  }

  async slashExecute({ interaction }: any) {
    const style = interaction.options.getString('style').toLowerCase();
    await this.setStyle(interaction, interaction.user.id, style);
  }

  async sendCurrentStyle(context: CommandContext, userId: any) {
    const currentStyle = db.getNpStyle(userId);
    const button = new ButtonBuilder()
      .setLabel("Support")
      .setURL(config.links?.supportServer || "https://discord.gg/XYwwyDKhec")
      .setStyle(ButtonStyle.Link);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${emoji.get('info') || 'ℹ️'} Current Player Style`)
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Your current Now Playing style is set to: **${currentStyle === 'card' ? 'Card Style' : 'Text Style'}**\n\nUse \`.preset <card|text>\` to change it.`)
          )
          .setButtonAccessory(button)
      );

    const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
    if (context.editReply && (context.deferred || context.replied)) await context.editReply(payload);
    else if (context.reply) await context.reply(payload);
    else await context.channel.send(payload);
  }

  async setStyle(context: CommandContext, userId: any, style: any) {
    if (!['card', 'text'].includes(style)) {
      const errorContainer = buildError('Please specify either `card` or `text`.', 'Invalid Style');
      const payload = { components: [errorContainer], flags: MessageFlags.IsComponentsV2 };
      if (context.editReply && (context.deferred || context.replied)) await context.editReply(payload);
      else if (context.reply) await context.reply(payload);
      else await context.channel.send(payload);
      return;
    }

    db.setNpStyle(userId, style);

    const note = phrases.get("presetUpdated");
    const successContainer = buildSuccess(
      `Your Now Playing style has been successfully changed to **${style === 'card' ? 'Card Style' : 'Text Style'}**.\n\n*${note}*`,
      'Style Updated'
    );

    const payload = { components: [successContainer], flags: MessageFlags.IsComponentsV2 };
    if (context.editReply && (context.deferred || context.replied)) await context.editReply(payload);
    else if (context.reply) await context.reply(payload);
    else await context.channel.send(payload);
  }
}

export default new PresetCommand();
