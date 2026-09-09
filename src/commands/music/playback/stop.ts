import {
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";

import { config } from "#config/config";
import { Command, CommandContext } from '#core/Command';
import { buildContainer, buildError, buildSuccess } from '#ui/Theme';
import emoji from "#config/emoji";
import phrases from "#utils/phrases";
import { PlayerManager } from '#audio/PlayerManager';

class StopCommand extends Command {
  constructor() {
    super({
      name: "stop",
      description:
        "Stop music playback, clear the queue, and disconnect from the voice channel",
      usage: "stop",
      aliases: ["disconnect", "leave"],
      category: "music",
      examples: ["stop", "disconnect", "leave"],
      cooldown: 3,
      access: {
        voice: true,
        sameVoice: true,
        player: true,
      },
      slash: {
        enabled: true,
        autoDefer: true,
        data: {
          name: "stop",
          description: "Stop music playback and clear the queue",
        },
      },
    });
  }

  async execute(ctx: CommandContext) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
    if (!activePm) return;
    return this._handleStop(context, activePm);
  }

  async slashExecute(ctx: CommandContext) {
    return this.execute(ctx);
  }

  async _handleStop(context: CommandContext, pm: PlayerManager) {
    const wasPlaying = pm.currentTrack;
    const queueLength = pm.queueSize;
    const is247Enabled = await pm.is247ModeEnabled()

    const lastTrackInfo = wasPlaying
      ? {
          title: wasPlaying.info.title,
          author: wasPlaying.info.author || "Unknown",
          duration: this._formatDuration(wasPlaying.info.duration),
          artworkUrl:
            wasPlaying.info.artworkUrl || config.assets.defaultTrackArtwork,
        }
      : null;

    await pm.stop();

    const container = buildContainer({
      title: is247Enabled ? "Queue Cleared" : "Playback Stopped",
      content: `**${is247Enabled ? "Queue Cleared" : "Playback Stopped"}**\n\n` +
        `└─ **${emoji.get("info") || "ℹ️"} Status:** ${is247Enabled ? "Remaining in channel (24/7 mode enabled)" : "Disconnected from voice channel"}\n` +
        `└─ **${emoji.get("folder") || "📁"} Tracks Cleared:** ${queueLength}`,
      thumbnail: lastTrackInfo
              ? lastTrackInfo.artworkUrl
              : config.assets?.defaultThumbnail ||
                  config.assets?.defaultTrackArtwork,
      icon: emoji.get("stop") || "🛑"
    });

    if (lastTrackInfo) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      );

      const lastTrackContent =
        `**Last Track**\n\n` +
        `└─ **${emoji.get("music")} Title:** ${lastTrackInfo.title}\n` +
        `└─ **${emoji.get("folder")} Artist:** ${lastTrackInfo.author}\n` +
        `└─ **${emoji.get("info")} Duration:** ${lastTrackInfo.duration}\n` +
        `└─ **${emoji.get("check")} Status:** ${is247Enabled ? "Cleared from queue" : "Stopped playing"}\n\n` +
        `*Track information from last playback*`;

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(lastTrackContent),
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(lastTrackInfo.artworkUrl),
          ),
      );
    }

    return this._reply(context, container);
  }

  _formatDuration(ms: any) {
    if (!ms || ms < 0) return "Live";
    const seconds = Math.floor((ms / 1000) % 60)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((ms / (1000 * 60)) % 60)
      .toString()
      .padStart(2, "0");
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 0) return `${hours}:${minutes}:${seconds}`;
    return `${minutes}:${seconds}`;
  }

  async _reply(context: CommandContext, container: any) {
    const payload = {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      fetchReply: true,
    };

    if (context.editReply && (context.deferred || context.replied)) {
      return await context.editReply(payload);
    }
    if (context.deferred || context.replied) {
      return await context.editReply!(payload);
    }
    return await (context as any).reply!(payload);
  }
}

export default new StopCommand();
