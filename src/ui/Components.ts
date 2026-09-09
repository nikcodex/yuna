import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize
} from 'discord.js';
import { formatDuration } from './Formatters';

export function createPlayerControls(options: any = {}) {
  const { mode = 'default' } = options;
  
  if (mode === 'playback') {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('yuna:music:rewind10').setLabel('-10s').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('yuna:music:rewind5').setLabel('-5s').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('yuna:music:forward5').setLabel('+5s').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('yuna:music:forward10').setLabel('+10s').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('yuna:music:replay').setLabel('Replay').setStyle(ButtonStyle.Primary)
    );
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('yuna:music:previous').setLabel('Prev').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('yuna:music:pause').setLabel('Pause / Resume').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('yuna:music:skip').setLabel('Skip').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('yuna:music:stop').setLabel('Stop').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('yuna:music:like').setLabel('Like').setStyle(ButtonStyle.Success)
  );
}

export function createPaginationRow(currentPage: any, totalPages: any, prefix: any = 'page') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`yuna:${prefix}:first`)
      .setLabel('First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId(`yuna:${prefix}:prev`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId(`yuna:${prefix}:current`)
      .setLabel(`${currentPage} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`yuna:${prefix}:next`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages),
    new ButtonBuilder()
      .setCustomId(`yuna:${prefix}:last`)
      .setLabel('Last')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages)
  );
}

export function createConfirmRow(confirmId = 'yuna:confirm:yes', cancelId = 'yuna:confirm:no') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(cancelId)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
  );
}

export function createFilterSelect(presets: any = []) {
  if (presets.length === 0) {
    presets = [
      { label: 'Reset Filters', description: 'Clear all active audio filters', value: 'filter_reset' },
      { label: 'Bassboost', description: 'Enhanced bass profile', value: 'filter_bass' },
      { label: 'Nightcore', description: 'Faster pitch & tempo', value: 'filter_nightcore' },
      { label: 'Vaporwave', description: 'Slow & relaxed retro vibe', value: 'filter_vaporwave' },
      { label: '8D Audio', description: 'Surround 8D spatial sound', value: 'filter_8d' },
      { label: 'Pop EQ', description: 'Vocal & pop acoustics', value: 'filter_pop' },
      { label: 'Rock EQ', description: 'Rock & heavy instruments', value: 'filter_rock' },
      { label: 'Treble Boost', description: 'Crisp high frequencies', value: 'filter_treble' }
    ];
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('yuna:music:filter')
    .setPlaceholder('Select an Audio Filter...');

  presets.forEach((preset: any) => {
    menu.addOptions({
      label: preset.label,
      description: preset.description,
      value: preset.value
    });
  });

  return new ActionRowBuilder().addComponents(menu);
}

export function createPlayerContainer(mode: any = 'default', options: any = {}) {
  const { isTextMode = false, track = null } = options;
  const container = new ContainerBuilder();

  if (isTextMode && track && track.info) {
    const duration = track.info.duration || 0;
    const position = options.position || 0;
    let progressBar = '';
    
    if (duration > 0 && !track.info.isStream) {
      const length = 15;
      const index = Math.max(0, Math.min(length, Math.round((position / duration) * length)));
      progressBar = `\n\n\`${formatDuration(position)}\` [${'▬'.repeat(index)}🔘${'▬'.repeat(length - index)}] \`${formatDuration(duration)}\``;
    } else if (track.info.isStream) {
      progressBar = `\n\n\`LIVE\` [🔘▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬]`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### 🎵 Now Playing: **${track.info.title}**\nby **${track.info.author}**${progressBar}`)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }

  const controlsRow = createPlayerControls({ mode });
  container.addActionRowComponents(controlsRow as any);

  return container;
}

const Components = {
  createPlayerControls,
  createPaginationRow,
  createConfirmRow,
  createFilterSelect,
  createPlayerContainer
};

export default Components;
