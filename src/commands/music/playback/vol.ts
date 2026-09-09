import { Command, CommandContext } from '#core/Command';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
} from "discord.js";
import type { Client, Message } from "discord.js";
import { PlayerManager } from '#audio/PlayerManager';
import { config } from "#config/config";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";
import { buildContainer, buildError, buildSuccess } from '#ui/Theme';
import phrases from "#utils/phrases";

class VolumeCommand extends Command {
  constructor() {
    super({
      name: "volume",
      description:
        "Adjust or view the music playback volume with an interactive control panel",
      usage: "volume [level]",
      aliases: ["v", "vol"],
      category: "music",
      examples: ["volume", "volume 50", "vol 100", "v 75"],
      cooldown: 2,
      access: {
        voice: true,
        sameVoice: true,
        player: true,
      },
      slash: {
        enabled: true,
        autoDefer: true,
        data: {
          name: "volume",
          description: "View or set the player volume",
          options: [
            {
              name: "level",
              description: "A number between 0 and 150",
              type: 4,
              required: false,
              min_value: 0,
              max_value: 150,
            },
          ],
        },
      },
    });
  }

  async execute(ctx: CommandContext) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
    if (!activePm) return;
    let level;
    if (interaction) {
      const opt = interaction.options.getInteger("level");
      if (opt !== null && opt !== undefined) level = opt;
    } else if (args[0]) {
      level = parseInt(args[0], 10);
    }
    return this._handleVolume(client, context, activePm, level);
  }

  async slashExecute(ctx: CommandContext) {
    return this.execute(ctx);
  }

  async _handleVolume(client: any, context: CommandContext, pm: PlayerManager, level: any) {
    if (typeof level === "number") {
      if (isNaN(level) || level < 0 || level > 150) {
        return this._reply(
          context,
          this._createErrorContainer(phrases.get("volumeInvalid")),
        );
      }
      await pm.setVolume(level);
    }

    const message = await this._reply(context, this._buildVolumeContainer(pm));
    if (message) {
      this._setupCollector(message, client, pm.guildId);
    }
  }

  _buildVolumeContainer(pm: PlayerManager) {
    const volume = pm.volume;
    const barLength = 15;
    const filledBlocks = Math.round((volume / 150) * barLength);
    const emptyBlocks = barLength - filledBlocks;
    const volumeBar = "█".repeat(filledBlocks) + "▒".repeat(emptyBlocks);
    const artworkUrl =
      pm.currentTrack?.info?.artworkUrl || config.assets.defaultTrackArtwork;

    const content =
      `**Current Settings**\n\n` +
      `└─ **${emoji.get("info")} Volume Level:** ${volume}%\n` +
      `└─ **${emoji.get("check")} Status:** ${volume === 0 ? "Muted" : "Active"}\n` +
      `└─ **${emoji.get("folder")} Range:** 0% - 150%\n` +
      `└─ **${emoji.get("reset")} Visual:** \`${volumeBar}\`\n\n` +
      `*Use the buttons below to adjust volume*`;

    return buildContainer({
        title: "Volume Control",
        content,
        thumbnail: artworkUrl,
        components: [this._createButtons(pm)],
        icon: emoji.get("music") || "🔊"
    });
  }

  _createButtons(pm: PlayerManager) {
    const volume = pm.volume;
    const isMuted = volume === 0;

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`vol_minus_10_${pm.guildId}`)
        .setLabel("-10")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(volume <= 0),
      new ButtonBuilder()
        .setCustomId(`vol_mute_${pm.guildId}`)
        .setLabel(isMuted ? "Unmute" : "Mute")
        .setStyle(isMuted ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`vol_plus_10_${pm.guildId}`)
        .setLabel("+10")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(volume >= 150),
    );
  }

  async _setupCollector(message: Message, client: any, guildId: any) {
    const filter = (i: any) =>
      i.customId.startsWith("vol_") && i.customId.endsWith(guildId);
    const collector = message.createMessageComponentCollector({
      filter,
      time: 120_000,
    });

    collector.on("collect", async (interaction: any) => {
      await interaction.deferUpdate();
      const player = client.music?.getPlayer(guildId);
      if (!player) {
        collector.stop();
        return;
      }

      const pm = new PlayerManager(player);
      const action = interaction.customId.split("_")[1];

      switch (action) {
        case "minus":
          await pm.setVolume(Math.max(0, pm.volume - 10));
          break;
        case "plus":
          await pm.setVolume(Math.min(150, pm.volume + 10));
          break;
        case "mute":
          if (pm.volume > 0) {
            pm.setData("oldVolume", pm.volume);
            await pm.setVolume(0);
          } else {
            const oldVolume = pm.getData("oldVolume") || 100;
            await pm.setVolume(oldVolume);
          }
          break;
      }

      const newContainer = this._buildVolumeContainer(pm);
      await interaction.editReply({ components: [newContainer] });
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
            "VolumeCommand",
            `Components disabled successfully. Reason: ${reason}`,
          );
        }
      } catch (error: any) {
        this._handleDisableError(error, reason);
      }
    });

    collector.on("dispose", async (interaction: any) => {
      logger.debug(
        "VolumeCommand",
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
        "VolumeCommand",
        `Failed to disable components: ${error.message}`,
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
        "VolumeCommand",
        `Message was deleted, cannot disable components. Reason: ${reason}`,
      );
    } else if (error.code === 50001) {
      logger.warn(
        "VolumeCommand",
        `Missing permissions to edit message. Reason: ${reason}`,
      );
    } else {
      logger.error(
        "VolumeCommand",
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

  _createErrorContainer(message: string) {
    return buildError(message);
  }

  async _reply(context: CommandContext, container: any) {
    const payload = {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      fetchReply: true,
    };
    try {
      if (context.editReply && (context.deferred || context.replied)) {
        return await context.editReply(payload);
      }
      const send = context.deferred || context.replied ? context.editReply!.bind(context) : context.reply!.bind(context);
      return await (send as (p: any) => any)(payload);
    } catch (e) {
      logger.error("VolumeCommand", "Failed to reply in Volume command:", e);
      return null;
    }
  }
}

export default new VolumeCommand();