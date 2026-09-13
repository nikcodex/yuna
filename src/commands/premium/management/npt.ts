import { Command, CommandContext } from '#core/Command';
import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, UserSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, MentionableSelectMenuBuilder } from "discord.js";
import type { Message } from "discord.js";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
import { db } from "#database/Database";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import { config } from "#config/config";
import phrases from "#utils/phrases";

class NoPrefixToggleCommand extends Command {
  constructor() {
    super({
      name: "noptoggle",
      description: "Toggle your personal no-prefix mode (Premium Only).",
      usage: "noptoggle [on/off]",
      aliases: ["npt", "noprefixtoggle", "noprefix", "nop"],
      category: "settings",
      examples: ["noptoggle", "noptoggle on", "npt off"],
      cooldown: 5,
      access: {
        premium: 'user',
      },
      slash: {
        enabled: true,
        data: {
          name: "noptoggle",
          description: "Toggle your personal no-prefix mode (Premium Only).",
          options: [
            {
              name: "action",
              description: "Enable or disable no-prefix mode.",
              type: 3,
              required: false,
              autocomplete: true,
            },
          ],
        },
      },
    });
  }

  _createUIContainer(username: any, currentStatus: any, action: string | null = null) {
    const statusText = currentStatus ? "Enabled" : "Disabled";
    const statusEmoji = currentStatus ? emoji.get("check") : emoji.get("cross");

    let content = `**Hello ${username}!** Manage your personal no-prefix mode here.\n\n`;

    if (action) {
      const note = phrases.get("modeToggled");
      content += `${emoji.get("check")} **Action Result**\nYour no-prefix mode has been **${action}**!\n*${note}*\n\n`;
    }

    content += `**${emoji.get("folder")} Current Status:** ${statusText} ${statusEmoji}\n\n`;

    content += `**${emoji.get("add")} How it works:**\n`;
    if (currentStatus) {
      content += `└─ You can use commands without any prefix\n`;
      content += `└─ Example: Type \`ping\` instead of \`.ping\`\n`;
      content += `└─ Or \`play song\` instead of \`.play song\`\n`;
      content += `└─ Basically, the bot will respond to commands without any prefix!\n\n`;
    } else {
      content += `└─ You need to use a server's prefix or mention me\n`;
      content += `└─ Example: Use \`.ping\` or \`@Yuna ping\`\n`;
      content += `└─ Enable this to use commands without prefixes\n`;
      content += `└─ Premium feature for enhanced convenience\n\n`;
    }

    content += `**${emoji.get("reset")} Benefits:**\n`;
    content += `└─ Faster command usage without typing prefixes\n`;
    content += `└─ Works across all servers instantly\n`;
    content += `└─ Toggle on/off anytime you want\n`;
    content += `└─ Premium exclusive feature`;

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("npt_toggle")
        .setLabel(currentStatus ? "Disable No-Prefix" : "Enable No-Prefix")
        .setStyle(currentStatus ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji(currentStatus ? emoji.get("cross") : emoji.get("check")),
      new ButtonBuilder()
        .setCustomId("npt_help")
        .setLabel("Help & Info")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emoji.get("info")),
    );

    return buildContainer({
      title: "No-Prefix Mode",
      content,
      thumbnail: config.assets.defaultThumbnail,
      icon: emoji.get("info"),
      components: [buttons]
    });
  }

  _createHelpContainer() {
    const content =
      `**What is No-Prefix Mode?**\nA premium feature that allows you to use bot commands without typing a prefix.\n\n` +
      `**${emoji.get("check")} How it works:**\n` +
      `└─ Instead of \`.ping\`, just type \`ping\`\n` +
      `└─ Instead of \`.play song\`, just type \`play song\`\n` +
      `└─ Your personal commands are now prefix-free!\n\n` +
      `**${emoji.get("folder")} Examples:**\n` +
      `└─ \`help\` → Shows help menu\n` +
      `└─ \`play never gonna give you up\` → Plays music\n` +
      `└─ \`queue\` → Shows music queue\n` +
      `└─ \`botinfo\` → Shows bot information\n\n` +
      `**${emoji.get("add")} Benefits:**\n` +
      `└─ Faster command execution\n` +
      `└─ More convenient for frequent users\n` +
      `└─ Toggle on/off anytime\n` +
      `└─ Premium exclusive feature`;

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("npt_back")
        .setLabel("Back to Settings")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emoji.get("reset")),
    );

    return buildContainer({
      title: "No-Prefix Help",
      content,
      thumbnail: config.assets.defaultThumbnail,
      icon: emoji.get("info"),
      components: [buttons]
    });
  }

  async _sendError(ctx: any, message: any) {
    const container = buildError(message);
    const replyOptions = {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      ephemeral: true,
    };
    if (ctx.user) {
        if (ctx.deferred || ctx.replied) await ctx.editReply(replyOptions);
        else await ctx.reply(replyOptions);
    } else {
        await ctx.channel.send(replyOptions);
    }
  }

  async _handleCommand(ctx: any, arg: any) {
    const isInteraction = !!ctx.user;
    const author = isInteraction ? ctx.user : ctx.author;
    const userId = author.id;
    const username = author.username;
    const currentStatus = db.hasNoPrefix(userId);

    let newStatus = currentStatus;
    let action = null;

    if (arg) {
      const lowerArg = arg.toLowerCase();
      if (["on", "enable", "true"].includes(lowerArg)) {
        newStatus = true;
        action = "enabled";
      } else if (["off", "disable", "false"].includes(lowerArg)) {
        newStatus = false;
        action = "disabled";
      } else {
        return this._sendError(
          ctx,
          `**Invalid option:** \`${arg}\`\n\n**Valid options:**\n├─ \`on\` or \`enable\` - Enable no-prefix mode\n└─ \`off\` or \`disable\` - Disable no-prefix mode`,
        );
      }
      db.users.setNoPrefix(userId, newStatus, null);
    }

    const container = this._createUIContainer(username, newStatus, action);
    const replyOptions = {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      fetchReply: true,
    };
    let sent;
    if (isInteraction) {
      if (ctx.deferred || ctx.replied) sent = await ctx.editReply(replyOptions);
      else sent = await ctx.reply(replyOptions);
    } else {
      sent = await ctx.channel.send(replyOptions);
    }
    this._setupCollector(sent, author);
  }

  async execute({ message, args }: any) {
    await this._handleCommand(message, args[0]);
  }

  async slashExecute({ interaction }: any) {
    await this._handleCommand(
      interaction,
      interaction.options.getString("action"),
    );
  }

  _setupCollector(message: Message, author: any) {
    const filter = (i: any) => i.user.id === author.id;
    const collector = message.createMessageComponentCollector({
      filter,
      time: 300_000,
    });

    collector.on("collect", async (interaction: any) => {
      try {
        await interaction.deferUpdate();
        const userId = interaction.user.id;
        const username = interaction.user.username;

        if (interaction.customId === "npt_toggle") {
          const currentStatus = db.hasNoPrefix(userId);
          const newStatus = !currentStatus;
          db.users.setNoPrefix(userId, newStatus, null);
          const updatedContainer = this._createUIContainer(
            username,
            newStatus,
            newStatus ? "enabled" : "disabled",
          );
          await interaction.editReply({ components: [updatedContainer] });
        } else if (interaction.customId === "npt_help") {
          await interaction.editReply({
            components: [this._createHelpContainer()],
          });
        } else if (interaction.customId === "npt_back") {
          const currentStatus = db.hasNoPrefix(userId);
          await interaction.editReply({
            components: [this._createUIContainer(username, currentStatus)],
          });
        }
      } catch (error) {
        logger.error("NoPrefixToggle", "Collector Error:", error);
      }
    });

    collector.on("end", async (collected: any, reason: any) => {
      if (reason === "limit" || reason === "messageDelete") return;

      try {
        const currentMessage = await this._fetchMessage(message).catch(
          () => null,
        );

        if (!currentMessage?.components?.length) {
          return;
        }

        const success = await this._disableAllComponents(currentMessage);

        if (success) {
          logger.debug(
            "NoPrefixToggle",
            `Components disabled successfully. Reason: ${reason}`,
          );
        }
      } catch (error) {
        this._handleDisableError(error, reason);
      }
    });

    collector.on("dispose", async (interaction: any) => {
      logger.debug(
        "NoPrefixToggle",
        `Interaction disposed: ${interaction.customId}`,
      );
    });
  }

  async _disableAllComponents(message: Message) {
    try {
      const disabledComponents = this._processComponents(message.components);

      await message.edit({
        components: disabledComponents,
        flags: MessageFlags.IsComponentsV2,
      });

      return true;
    } catch (error: any) {
      logger.error(
        "NoPrefixToggle",
        `Failed to disable components: ${error?.message}`,
        error,
      );
      return false;
    }
  }

  _processComponents(components: any) {
    return components.map((component: any) => {
      if (component.type === ComponentType.ActionRow) {
        return {
          ...component.toJSON(),
          components: component.components.map((subComponent: any) => ({
            ...subComponent.toJSON(),
            disabled: true,
          })),
        };
      }

      if (component.type === ComponentType.Container) {
        return {
          ...component.toJSON(),
          components: this._processComponents(component.components),
        };
      }

      if (component.type === ComponentType.Section) {
        const processedComponent = {
          ...component.toJSON(),
          components: this._processComponents(component.components),
        };

        if (
          component.accessory &&
          component.accessory.type === ComponentType.Button
        ) {
          processedComponent.accessory = {
            ...component.accessory.toJSON(),
            disabled: true,
          };
        }

        return processedComponent;
      }

      return component.toJSON();
    });
  }

  _handleDisableError(error: any, reason: any) {
    if (error.code === 10008) {
      logger.debug(
        "NoPrefixToggle",
        `Message was deleted, cannot disable components. Reason: ${reason}`,
      );
    } else if (error.code === 50001) {
      logger.warn(
        "NoPrefixToggle",
        `Missing permissions to edit message. Reason: ${reason}`,
      );
    } else {
      logger.error(
        "NoPrefixToggle",
        `Error disabling components: ${error.message}. Reason: ${reason}`,
        error,
      );
    }
  }

  async _fetchMessage(messageOrInteraction: any) {
    if (messageOrInteraction.fetchReply) {
      return await messageOrInteraction.fetchReply();
    } else if (messageOrInteraction.fetch) {
      return await messageOrInteraction.fetch();
    } else {
      return messageOrInteraction;
    }
  }

  _shouldDisableComponent(component: any) {
    const selectMenuTypes = [
      StringSelectMenuBuilder,
      UserSelectMenuBuilder,
      RoleSelectMenuBuilder,
      ChannelSelectMenuBuilder,
      MentionableSelectMenuBuilder,
    ];

    if (selectMenuTypes.some((type) => component instanceof type)) {
      return true;
    }

    if (component instanceof ButtonBuilder) {
      return component.data.style !== ButtonStyle.Link;
    }

    return false;
  }

  async autocomplete({ interaction }: any) {
    const focusedValue = interaction.options.getFocused();
    const choices = [
      { name: "Enable no-prefix mode", value: "on" },
      { name: "Disable no-prefix mode", value: "off" },
    ];
    const filtered = choices.filter((choice) =>
      choice.name.toLowerCase().includes(focusedValue.toLowerCase()),
    );
    await interaction.respond(filtered);
  }
}

export default new NoPrefixToggleCommand();

// Made by Nikhil Under CodeX Devs
