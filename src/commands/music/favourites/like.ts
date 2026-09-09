import { Command } from '#core/Command';
import { db } from '#database/Database';
import emoji from "#config/emoji";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from '#ui/Theme';
import phrases from "#utils/phrases";

class LikeCommand extends Command {
  constructor() {
    super({
      name: "like",
      description: "Add the currently playing song to your liked songs",
      usage: "like",
      aliases: ["love", "favourite"],
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
          name: "like",
          description: "Add the currently playing song to your liked songs"
        }
      }
    });
  }

  async execute(ctx: any) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const userId = (context.user || context.author).id;
    return this._handleLike(context, client, userId);
  }

  async slashExecute(ctx: any) {
    return this.execute(ctx);
  }

  async _handleLike(context: any, client: any, userId: any) {
    const player = client.music?.getPlayer(context.guild?.id || context.guildId);
    const track = player?.queue?.current;

    if (!track) {
      const container = buildError(phrases.get("noTrackPlaying"));
      return this._reply(context, container);
    }

    let added;
    try {
      added = (db as any).liked.addLikedTrack(userId, track.info);
    } catch (err: any) {
      return this._reply(context, buildError(`Failed to add to favorites: ${err.message}`));
    }
    const likeNote = phrases.get("likeAdded");

    const container = added
      ? buildSuccess(`❤️ Added **${track.info.title}** to your liked songs!\n\n*${likeNote}*`, "Favorites")
      : buildError(`**${track.info.title}** is already in your liked songs!`, "Favorites");

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

export default new LikeCommand();
