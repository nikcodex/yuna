import { Command } from '#core/Command';
import { db } from '#database/Database';
import emoji from "#config/emoji";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from '#ui/Theme';
import phrases from "#utils/phrases";

class LikeAllCommand extends Command {
  constructor() {
    super({
      name: "likeall",
      description: "Add all songs currently in the queue to your liked songs",
      usage: "likeall",
      aliases: ["loveall"],
      category: "music",
      cooldown: 5,
      access: {
        voice: true,
        player: true,
      },
      slash: {
        enabled: true,
        autoDefer: true,
        data: {
          name: "likeall",
          description: "Add all songs currently in the queue to your liked songs"
        }
      }
    });
  }

  async execute(ctx: any) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const userId = (context.user || context.author).id;
    return this._handleLikeAll(context, client, userId);
  }

  async slashExecute(ctx: any) {
    return this.execute(ctx);
  }

  async _handleLikeAll(context: any, client: any, userId: any) {
    const player = client.music?.getPlayer(context.guild?.id || context.guildId);

    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      const container = buildError(phrases.get("noTrackPlaying"));
      return this._reply(context, container);
    }

    let addedCount = 0;

    if (player.queue.current) {
      if ((db as any).liked.addLikedTrack(userId, player.queue.current.info)) addedCount++;
    }

    for (const track of player.queue.tracks) {
      if ((db as any).liked.addLikedTrack(userId, track.info)) {
        addedCount++;
      }
    }

    const likedAllNote = phrases.get("likedAll");
    const container = addedCount > 0
      ? buildSuccess(`❤️ Added **${addedCount}** new songs to your liked songs!\n\n*${likedAllNote}*`, "Favorites")
      : buildError("All songs in the queue are already in your liked songs!", "Favorites");

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

export default new LikeAllCommand();

// Made by Nikhil Under CodeX Devs
