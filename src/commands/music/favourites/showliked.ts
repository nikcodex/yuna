import { Command } from '#core/Command';
import { db } from '#database/Database';
import { ContainerBuilder, MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from '#ui/Theme';
import emoji from "#config/emoji";
import phrases from "#utils/phrases";

class ShowLikedCommand extends Command {
  constructor() {
    super({
      name: "showliked",
      description: "View your liked songs",
      usage: "showliked",
      aliases: ["liked", "myfavorites"],
      category: "music",
      cooldown: 3,
      slash: {
        enabled: true,
        autoDefer: true,
        data: {
          name: "showliked",
          description: "View your liked songs"
        }
      }
    });
  }

  async execute(ctx: any) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const user = context.user || context.author;
    return this._handleShowLiked(context, user);
  }

  async slashExecute(ctx: any) {
    return this.execute(ctx);
  }

  async _handleShowLiked(context: any, user: any) {
    const tracks = (db as any).liked.getUserLiked(user.id);

    if (tracks.length === 0) {
      return this._reply(context, buildError(phrases.get("noLikedTracks"), "No Liked Songs"));
    }

    let content = "";
    tracks.slice(0, 20).forEach((t: any,  i: any) => {
      content += `└─ **${i + 1}.** ${t.title}\n`;
    });
    if (tracks.length > 20) {
      content += `\n*...and ${tracks.length - 20} more tracks*`;
    }

    const container = buildContainer({ image: undefined, 
      title: `❤️ **${user.username}'s Liked Songs**`,
      content: content,
      thumbnail: user.displayAvatarURL({ dynamic: true }),
      icon: emoji.get("info") || "ℹ️"
    });

    return this._reply(context, container);
  }

  async _reply(context: any, container: any) {
    const payload = {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
    if (context.editReply && (context.deferred || context.replied)) {
      return await context.editReply(payload);
    }
    return await (context.deferred || context.replied ? context.editReply.bind(context) : context.reply.bind(context))(payload);
  }
}

export default new ShowLikedCommand();
