import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, } from 'discord.js';
import { PlayerManager } from '#audio/PlayerManager';
import { logger } from '#utils/logger';
import { db } from '#database/Database';
import { createPlayerContainer } from '#ui/Components';
function buildResponseContainer(title, text) {
    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### **${title}**`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
}
let registered = false;
function registerPlayerButtons(client) {
    if (registered)
        return;
    registered = true;
    const defaultOptions = { defer: true, sameUser: false, sameVoice: true };
    // @ts-ignore
    const registerBoth = (shortName, yunaName, handler, options = defaultOptions) => {
        client.components.register(shortName, handler, options);
        client.components.register(yunaName, handler, options);
    };
    // Previous
    registerBoth('music_previous', 'yuna:music:previous', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        const hasPrevious = await pm.playPrevious();
        const response = hasPrevious ? 'Playing previous track.' : 'No previous track available.';
        await interaction.editReply({ components: [buildResponseContainer('Previous Track', response)], flags: MessageFlags.IsComponentsV2 });
    });
    // Pause / Resume
    registerBoth('music_pause', 'yuna:music:pause', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        let response = '';
        let title = '';
        if (pm.isPaused) {
            await pm.resume();
            title = 'Music Resumed';
            response = 'Music resumed.';
        }
        else {
            await pm.pause();
            title = 'Music Paused';
            response = 'Music paused.';
        }
        await interaction.editReply({ components: [buildResponseContainer(title, response)], flags: MessageFlags.IsComponentsV2 });
    });
    // Skip
    registerBoth('music_skip', 'yuna:music:skip', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        const trackTitle = pm.currentTrack?.info?.title || 'Unknown Track';
        await pm.skip();
        await interaction.editReply({ components: [buildResponseContainer('Track Skipped', `Skipped: **${trackTitle}**`)], flags: MessageFlags.IsComponentsV2 });
    });
    // Stop
    registerBoth('music_stop', 'yuna:music:stop', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        await pm.stop();
        await interaction.editReply({ components: [buildResponseContainer('Music Stopped', 'Music stopped and queue cleared.')], flags: MessageFlags.IsComponentsV2 });
    });
    // Like
    registerBoth('music_like', 'yuna:music:like', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        const trackToLike = pm.currentTrack;
        let response = '';
        if (!trackToLike) {
            response = 'No track is currently playing.';
        }
        else {
            const added = db.liked?.addLikedTrack ? db.liked.addLikedTrack(interaction.user.id, trackToLike.info) : false;
            response = added
                ? `Added **${trackToLike.info.title}** to your liked songs!`
                : `**${trackToLike.info.title}** is already in your liked songs!`;
        }
        await interaction.editReply({ components: [buildResponseContainer('Favourites', response)], flags: MessageFlags.IsComponentsV2 });
    });
    // Seek / Rewind / Forward
    registerBoth('music_rewind10', 'yuna:music:rewind10', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        await pm.rewind(10000);
        await interaction.editReply({ components: [buildResponseContainer('Playback Seek', 'Rewound **-10s**')], flags: MessageFlags.IsComponentsV2 });
    });
    registerBoth('music_rewind5', 'yuna:music:rewind5', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        await pm.rewind(5000);
        await interaction.editReply({ components: [buildResponseContainer('Playback Seek', 'Rewound **-5s**')], flags: MessageFlags.IsComponentsV2 });
    });
    registerBoth('music_forward5', 'yuna:music:forward5', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        await pm.forward(5000);
        await interaction.editReply({ components: [buildResponseContainer('Playback Seek', 'Fast-forwarded **+5s**')], flags: MessageFlags.IsComponentsV2 });
    });
    registerBoth('music_forward10', 'yuna:music:forward10', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        await pm.forward(10000);
        await interaction.editReply({ components: [buildResponseContainer('Playback Seek', 'Fast-forwarded **+10s**')], flags: MessageFlags.IsComponentsV2 });
    });
    registerBoth('music_replay', 'yuna:music:replay', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        if (!player)
            return interaction.editReply({ components: [buildResponseContainer('Error', 'No active player in this server.')], flags: MessageFlags.IsComponentsV2 });
        const pm = new PlayerManager(player);
        await pm.replay();
        await interaction.editReply({ components: [buildResponseContainer('Track Replay', 'Replaying track from start.')], flags: MessageFlags.IsComponentsV2 });
    });
    // Menus
    registerBoth('np_feature_menu', 'yuna:music:feature', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        const selectedValue = interaction.values[0];
        const selectedMode = selectedValue.replace('mode_', '');
        player.set('controlMode', selectedMode);
        try {
            const style = interaction.user?.id ? db.getNpStyle?.(interaction.user.id) : 'card';
            const isTextMode = style === 'text';
            const track = player.queue?.current;
            const newContainer = createPlayerContainer ? createPlayerContainer(selectedMode, { isTextMode, track }) : buildResponseContainer('Mode Changed', `Changed to ${selectedMode}`);
            await interaction.message.edit({
                components: [newContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
        catch (err) {
            // @ts-ignore
            logger.debug('PlayerButtons', `Failed to update mode controls: ${err.message}`);
        }
    });
    registerBoth('np_filter_menu', 'yuna:music:filter', async (interaction) => {
        const player = client.music?.getPlayer(interaction.guild.id);
        const selectedFilter = interaction.values[0];
        let filterName = selectedFilter.replace('filter_', '');
        await interaction.editReply({ components: [buildResponseContainer("Audio Filter", `Applied filter: **${filterName}**`)], flags: MessageFlags.IsComponentsV2 });
    });
}
export default {
    name: "interactionCreate",
    once: false,
    async execute(interaction, client) {
        if (!registered) {
            registerPlayerButtons(client);
        }
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            try {
                await client.components.handle(interaction);
            }
            catch (error) {
                logger.error('InteractionCreate', 'Error handling component:', error);
            }
        }
    }
};
