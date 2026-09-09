import { MessageFlags } from 'discord.js';
import { config } from '#config/config';
import { Command } from '#core/Command';
import emoji from '#config/emoji';
import { buildContainer, buildError } from '#ui/Theme';
import phrases from '#utils/phrases';
import { PlayerManager } from '#audio/PlayerManager';

class PauseCommand extends Command {
  constructor() {
    super({
      name: 'pause',
      description: 'Pause the currently playing track',
      usage: 'pause',
      aliases: ['pa'],
      category: 'music',
      examples: [
        'pause',
        'pa',
      ],
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
          name: 'pause',
          description: 'Pause the currently playing track',
        },
      },
    });
  }

  async execute(ctx: any) {
    const { client, message, interaction, player, pm, args = [] } = ctx;
    const context = interaction || message;
    const activePm = pm || (player ? new PlayerManager(player) : (client?.music?.getPlayer(context.guildId || context.guild?.id) ? new PlayerManager(client.music.getPlayer(context.guildId || context.guild?.id)) : null));
    if (!activePm) return;
    return this._handlePause(context, activePm);
  }

  async slashExecute(ctx: any) {
    return this.execute(ctx);
  }

  async _handlePause(context: any, pm: any) {
    if (pm.isPaused) {
      return this._reply(context, buildError({ issue: 'The player is already paused.', tip: 'Use `/resume` to continue playback.', title: 'Player Paused' }));
    }

    try {
      await pm.pause();
    } catch (err: any) {
      return this._reply(context, buildError({ issue: `Failed to pause: ${err.message}`, title: 'Pause Error' }));
    }

    const { currentTrack } = pm;
    const duration = currentTrack.info.length || currentTrack.info.duration;
    const pauseNote = phrases.get('playbackPaused');

    const content = `**Track Information**\n\n` +
      `└─ **${(emoji as any).get('music')} Title:** ${currentTrack.info.title}\n` +
      `└─ **${(emoji as any).get('folder')} Artist:** ${currentTrack.info.author || 'Unknown'}\n` +
      `└─ **${(emoji as any).get('info')} Duration:** ${this._formatDuration(duration)}\n` +
      `└─ **${(emoji as any).get('check')} Status:** Playback paused\n\n` +
      `*${pauseNote}*`;

    const container = buildContainer({
        title: "Player Paused",
        content,
        thumbnail: currentTrack?.info?.artworkUrl || config.assets?.defaultTrackArtwork,
        icon: (emoji as any).get('music') || "⏸️"
    } as any);

    return this._reply(context, container);
  }

  _formatDuration(ms: number) {
    if (!ms || ms < 0) return 'Live';
    const seconds = Math.floor((ms / 1000) % 60).toString().padStart(2, '0');
    const minutes = Math.floor((ms / (1000 * 60)) % 60).toString().padStart(2, '0');
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 0) return `${hours}:${minutes}:${seconds}`;
    return `${minutes}:${seconds}`;
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

export default new PauseCommand();