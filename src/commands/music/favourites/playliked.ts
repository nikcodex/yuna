import { Command } from '#core/Command';
import { db } from '#database/Database';
import { PlayerManager } from '#audio/PlayerManager';
import emoji from "#config/emoji";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from '#ui/Theme';
import { logger } from '#utils/logger';
import phrases from "#utils/phrases";

class PlayLikedCommand extends Command {
  constructor() {
    super({
      name: "playliked",
      description: "Play all your liked songs",
      usage: "playliked",
      aliases: ["pl"],
      category: "music",
      cooldown: 5,
      access: {
        voice: true,
      },
      slash: {
        enabled: true,
        autoDefer: true,
        data: {
          name: "playliked",
          description: "Play all your liked songs"
        }
      }
    });
  }

  async execute(ctx: any) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const voiceChannel = context.member?.voice?.channel;
    const userId = (context.user || context.author).id;
    return this._handlePlayLiked(context, client, userId, voiceChannel);
  }

  async slashExecute(ctx: any) {
    return this.execute(ctx);
  }

  async _handlePlayLiked(context: any, client: any, userId: any, voiceChannel: any) {
    if (!voiceChannel) {
      const container = buildError("You must be in a voice channel to play your liked songs.", "Voice Required");
      return this._reply(context, container);
    }

    const tracks = (db as any).liked.getUserLiked(userId);

    if (tracks.length === 0) {
      const container = buildError(phrases.get("noLikedTracks"), "No Liked Songs");
      return this._reply(context, container);
    }

    let player = client.music.getPlayer(context.guild.id);
    if (!player) {
      player = await client.music.createPlayer({
        guildId: context.guild.id,
        textChannelId: context.channel.id,
        voiceChannelId: voiceChannel.id,
      });
    }

    const pm = new PlayerManager(player);
    if (!pm.isConnected) {
      await pm.connect();
    }

    const wasEmpty = !pm.currentTrack && pm.queueSize === 0;
    let addedCount = 0;

    for (const t of tracks) {
      try {
        const query = t.uri || (t.author ? `${t.title} ${t.author}` : t.title);
        const searchResult = await client.music.search(query, {
          requester: context.user || context.author,
        });

        if (searchResult?.tracks?.length > 0) {
          await pm.addTracks(searchResult.tracks[0]);
          addedCount++;
        }
      } catch (err: any) {
        logger.warn('PlayLiked', `Failed to resolve track: ${err.message}`);
      }
    }

    if (wasEmpty && addedCount > 0) {
      await pm.play();
    }

    const container = addedCount > 0
      ? buildSuccess(`❤️ Loaded and queued **${addedCount}** liked songs!`, "Playing Favorites")
      : buildError("Could not resolve any of your liked songs. Try adding them again!", "Favorites");

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

export default new PlayLikedCommand();
