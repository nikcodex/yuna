import { ContainerBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, } from 'discord.js';
import emoji from '#config/emoji';
export class AntiAbuse {
    cooldowns;
    cooldownNotifications;
    mentionNotifications;
    violations;
    constructor() {
        this.cooldowns = new Map();
        this.cooldownNotifications = new Map();
        this.mentionNotifications = new Map();
        this.violations = new Map();
    }
    getCooldownData(userId, commandName) {
        const key = `${userId}:${commandName}`;
        return this.cooldowns.get(key) || null;
    }
    checkCooldown(userId, command, messageOrInteraction) {
        const commandName = command.name;
        const cooldownDuration = (command.cooldown || 3) * 1000;
        const now = Date.now();
        const key = `${userId}:${commandName}`;
        const existing = this.cooldowns.get(key);
        if (!existing) {
            this.cooldowns.set(key, {
                userId,
                commandName,
                lastUsed: now,
                violationCount: 0,
                violationTimestamps: []
            });
            return { onCooldown: false, remainingTime: 0 };
        }
        const timePassed = now - existing.lastUsed;
        if (timePassed < cooldownDuration) {
            const remainingTime = Math.ceil((cooldownDuration - timePassed) / 1000);
            existing.violationCount = (existing.violationCount || 0) + 1;
            existing.violationTimestamps = existing.violationTimestamps || [];
            existing.violationTimestamps.push(now);
            // Prune timestamps older than 1 hour
            const oneHourAgo = now - 3600000;
            existing.violationTimestamps = existing.violationTimestamps.filter((t) => t > oneHourAgo);
            this.cooldowns.set(key, existing);
            return { onCooldown: true, remainingTime };
        }
        existing.lastUsed = now;
        existing.violationCount = 0;
        existing.violationTimestamps = [];
        this.cooldowns.set(key, existing);
        return { onCooldown: false, remainingTime: 0 };
    }
    async sendCooldownNotification(messageOrInteraction, remainingTime, command) {
        const userId = messageOrInteraction.user?.id || messageOrInteraction.author?.id;
        if (!userId)
            return;
        const now = Date.now();
        const lastNotif = this.cooldownNotifications.get(userId) || 0;
        if (now - lastNotif < 3000)
            return;
        this.cooldownNotifications.set(userId, now);
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder()
            .setContent(`### ${emoji.get('cross') || '❌'} Cooldown Active`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(new SectionBuilder()
            // @ts-ignore
            .setTextDisplay(new TextDisplayBuilder().setContent(`Please wait **${remainingTime}s** before using \`${command.name}\` again.`)));
        try {
            if (messageOrInteraction.reply) {
                if (messageOrInteraction.deferred || messageOrInteraction.replied) {
                    await messageOrInteraction.followUp({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    }).catch(() => { });
                }
                else {
                    await messageOrInteraction.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    }).catch(() => { });
                }
            }
        }
        catch (e) {
            // Ignore notification failures
        }
    }
}
export const antiAbuse = new AntiAbuse();
export default antiAbuse;
