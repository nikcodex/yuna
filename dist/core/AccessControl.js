import { config } from '#config/config';
import { db } from '#database/Database';
import { TTLCache } from '#utils/cache';
// Cache premium status for 60 seconds
const premiumCache = new TTLCache(60000, 1000);
/**
 * Checks if a member has required Discord permissions.
 */
export function checkPermissions(member, requiredPerms) {
    if (!requiredPerms || requiredPerms.length === 0)
        return true;
    if (!member)
        return false;
    return requiredPerms.every(perm => member.permissions.has(perm));
}
/**
 * Checks if the bot has required permissions in the guild/channel.
 */
export function checkBotPermissions(guild, requiredPerms, channel = null) {
    if (!guild || !requiredPerms || requiredPerms.length === 0)
        return [];
    const botMember = guild.members.me;
    if (!botMember)
        return [];
    // @ts-ignore
    const perms = channel ? botMember.permissionsIn(channel) : botMember.permissions;
    return requiredPerms
        .filter(perm => !perms.has(perm))
        .map(perm => perm.toString()); // Could map to permission names if needed
}
/**
 * Checks if a user/guild has premium access.
 */
export function isPremium(userId, guildId, type = 'any') {
    const cacheKey = `${userId}-${guildId}-${type}`;
    if (premiumCache.has(cacheKey)) {
        return premiumCache.get(cacheKey);
    }
    let result = false;
    switch (type) {
        case 'user':
            result = !!db.isUserPremium?.(userId);
            break;
        case 'guild':
            result = guildId ? !!db.isGuildPremium?.(guildId) : false;
            break;
        case 'any':
        default:
            // @ts-ignore
            result = !!db.hasAnyPremium?.(userId, guildId);
            break;
    }
    premiumCache.set(cacheKey, result);
    return result;
}
/**
 * Checks if a user is the bot owner.
 */
export function isOwner(userId) {
    return Array.isArray(config.ownerIds) && config.ownerIds.includes(userId);
}
/**
 * Checks if a user or guild is blacklisted.
 */
export function isBlacklisted(userId, guildId) {
    const userBl = db.isUserBlacklisted?.(userId);
    const guildBl = guildId ? db.isGuildBlacklisted?.(guildId) : false;
    return !!(userBl || guildBl);
}
