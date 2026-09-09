import { MessageFlags } from "discord.js";
import { config } from "#config/config";
import { Command, CommandContext } from '#core/Command';
import emoji from "#config/emoji";
import { buildContainer, buildError } from '#ui/Theme';
import phrases from "#utils/phrases";
import { PlayerManager } from '#audio/PlayerManager';

class ResumeCommand extends Command {
  constructor() {
    super({
      name: "resume",
      description: "Resume the paused track and continue playback",
      usage: "resume",
      aliases: ["unpause"],
      category: "music",
      examples: ["resume", "unpause"],
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
          name: "resume",
          description: "Resume the paused track and continue playback",
        },
      },
    });
  }

  async execute(ctx: CommandContext) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
    if (!activePm) return;
    return this._handleResume(context, activePm);
  }

  async slashExecute(ctx: CommandContext) {
    return this.execute(ctx);
  }

  async _handleResume(context: CommandContext, pm: PlayerManager) {
    if (!pm.isPaused) {
      return this._reply(
        context,
        buildError({ issue: "The player is not paused.", tip: "Use `/pause` to pause the current song.", title: "Player Active" }),
      );
    }

    try {
      await pm.resume();
    } catch (err: any) {
      return this._reply(context, buildError({ issue: `Failed to resume: ${err.message}`, title: 'Resume Error' }));
    }

    const { currentTrack } = pm;
    const duration = currentTrack.info.length || currentTrack.info.duration;
    const resumeNote = phrases.get("playbackResumed");

    const content =
      `**Track Information**\n\n` +
      `└─ **${emoji.get("music")} Title:** ${currentTrack.info.title}\n` +
      `└─ **${emoji.get("folder")} Artist:** ${currentTrack.info.author || "Unknown"}\n` +
      `└─ **${emoji.get("info")} Duration:** ${this._formatDuration(duration)}\n` +
      `└─ **${emoji.get("check")} Status:** Playback resumed\n\n` +
      `*${resumeNote}*`;

    const container = buildContainer({
        title: "Player Resumed",
        content,
        thumbnail: currentTrack?.info?.artworkUrl || config.assets.defaultTrackArtwork,
        icon: emoji.get("music") || "▶️"
    });

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
export default new ResumeCommand();
