import { Command } from '#core/Command';
import { db } from '#database/Database';
import emoji from "#config/emoji";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from '#ui/Theme';
import phrases from "#utils/phrases";

class UnlikeCommand extends Command {
  constructor() {
    super({
      name: "unlike",
      description: "Remove the currently playing song from your liked songs",
      usage: "unlike",
      aliases: ["unlove"],
      category: "music",
      cooldown: 2,
      access: {
        voice: true,
        player: true,
        playing: true,
      },
      slash: {
        enabled: true,
        autoDefer: true,
        data: {
          name: "unlike",
          description: "Remove the currently playing song from your liked songs"
        }
      }
    });
  }

  async execute(ctx: any) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const userId = (context.user || context.author).id;
    return this._handleUnlike(context, client, userId);
  }

  async slashExecute(ctx: any) {
    return this.execute(ctx);
  }

  async _handleUnlike(context: any, client: any, userId: any) {
    const player = client.music?.getPlayer(context.guild?.id || context.guildId);
    const track = player?.queue?.current;

    if (!track) {
      const container = buildError(phrases.get("noTrackPlaying"));
      return this._reply(context, container);
    }

    let removed;
    try {
      removed = (db as any).liked.removeLikedTrack(userId, track.info.identifier);
    } catch (err: any) {
      return this._reply(context, buildError(`Failed to remove from favorites: ${err.message}`));
    }
    const unlikeNote = phrases.get("likeRemoved");

    const container = removed
      ? buildSuccess(`Removed **${track.info.title}** from your liked songs.\n\n*${unlikeNote}*`, "Favorites")
      : buildError(`**${track.info.title}** is not in your liked songs!`, "Favorites");

    return this._reply(context, container);
  }

  async _reply(context: any, container: any) {
    const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
    if (context.editReply && (context.deferred || context.replied)) {
      return await context.editReply(payload);
    }
    return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
  }
}

export default new UnlikeCommand();

// Made by Nikhil Under CodeX Devs
