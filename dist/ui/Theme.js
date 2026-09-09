import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder, ActionRowBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } from 'discord.js';
import emoji from '#config/emoji';
export function buildContainer(options = {}) {
    const { title, content, thumbnail, image, components, icon, subtitle } = options;
    const container = new ContainerBuilder();
    let headerText = `${icon || ''} **${title}**`;
    if (subtitle) {
        headerText += `\n**${subtitle}**`;
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    if (content && thumbnail) {
        try {
            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail));
            container.addSectionComponents(section);
        }
        catch (_) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
        }
    }
    else if (content) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    }
    if (image) {
        const mediaGallery = new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image));
        container.addMediaGalleryComponents(mediaGallery);
    }
    (components || []).forEach((row) => {
        if (row instanceof ActionRowBuilder) {
            container.addActionRowComponents(row);
        }
    });
    return container;
}
/**
 * Signature Boxed Error Card Builder
 */
export function buildError(errorInput, title = "Error") {
    const infoIcon = emoji.get('info') || 'ℹ️';
    const resetIcon = emoji.get('reset') || '🔄';
    const crossIcon = emoji.get('cross') || '❌';
    let issueText = typeof errorInput === 'string' ? errorInput : (errorInput.issue || errorInput.message || 'Something went wrong.');
    let actionText = typeof errorInput === 'object' && errorInput.tip ? errorInput.tip : 'Try again or contact support';
    let subtitle = typeof errorInput === 'object' && errorInput.title ? errorInput.title : 'Something went wrong';
    let content = `┌─ **${infoIcon} Issue:** ${issueText}\n`;
    content += `└─ **${resetIcon} Action:** ${actionText}\n\n`;
    content += `*Please check your input and try again*`;
    return buildContainer({ image: null, thumbnail: null, title, subtitle, content, icon: undefined });
}
/**
 * Signature Boxed Success Card Builder
 */
export function buildSuccess(successInput, title = "Success") {
    const checkIcon = emoji.get('check') || '✅';
    const infoIcon = emoji.get('info') || 'ℹ️';
    let messageText = typeof successInput === 'string' ? successInput : (successInput.message || successInput.content || 'Action completed successfully.');
    let detailText = typeof successInput === 'object' && successInput.detail ? successInput.detail : 'Action performed';
    let subtitle = typeof successInput === 'object' && successInput.title ? successInput.title : 'Action Completed';
    let content = `┌─ **${checkIcon} Result:** ${messageText}\n`;
    if (detailText) {
        content += `└─ **${infoIcon} Detail:** ${detailText}`;
    }
    else {
        content += `└─ **${infoIcon} Status:** Completed`;
    }
    return buildContainer({ image: null, thumbnail: null, title, subtitle, content, icon: undefined });
}
/**
 * Signature Boxed Info Card Builder
 */
export function buildInfo(infoInput, title = "Information") {
    const infoIcon = emoji.get('info') || 'ℹ️';
    let messageText = typeof infoInput === 'string' ? infoInput : (infoInput.message || infoInput.content);
    let subtitle = typeof infoInput === 'object' && infoInput.title ? infoInput.title : null;
    return buildContainer({ image: null, thumbnail: null,
        title,
        subtitle,
        content: messageText,
        icon: infoIcon
    });
}
/**
 * Signature Boxed Warning Card Builder
 */
export function buildWarning(warningInput, title = "Warning") {
    const infoIcon = emoji.get('info') || 'ℹ️';
    const crossIcon = emoji.get('cross') || '⚠️';
    let messageText = typeof warningInput === 'string' ? warningInput : (warningInput.message || warningInput.content);
    let subtitle = typeof warningInput === 'object' && warningInput.title ? warningInput.title : 'Attention Needed';
    let content = `┌─ **${infoIcon} Warning:** ${messageText}\n`;
    content += `└─ **${emoji.get('reset') || '🔄'} Action:** Please review settings and retry`;
    return buildContainer({ image: null, thumbnail: null, title, subtitle, content, icon: undefined });
}
/**
 * Signature Boxed Loading Card Builder
 */
export function buildLoading(loadingInput, title = "Loading...") {
    const loadingIcon = emoji.get('loading') || '⏳';
    let messageText = typeof loadingInput === 'string' ? loadingInput : (loadingInput.message || loadingInput.content || 'Please wait...');
    return buildContainer({ image: null, thumbnail: null,
        title,
        content: `${loadingIcon} ${messageText}`,
        icon: loadingIcon
    });
}
const Theme = {
    buildContainer,
    buildError,
    buildSuccess,
    buildInfo,
    buildWarning,
    buildLoading,
    buildYunaContainer: buildContainer,
    buildYunaError: buildError,
    buildYunaSuccess: buildSuccess
};
export { buildContainer as buildYunaContainer, buildError as buildYunaError, buildSuccess as buildYunaSuccess };
export default Theme;
