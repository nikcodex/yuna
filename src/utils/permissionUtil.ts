import { PermissionFlagsBits } from 'discord.js';
import { config } from '#config/config';
import { db } from '#database/Database';

const ownerSet = new Set(config.ownerIds || []);
const permissionNames = new Map();

for (const [name, value] of Object.entries(PermissionFlagsBits)) {
	permissionNames.set(
		value,
		name
			.split('_')
			.map(word => word.charAt(0) + word.slice(1).toLowerCase())
			.join(' '),
	);
}

export function isOwner(userId: any) {
	return ownerSet.has(userId);
}

export function canUseCommand(member: any, command: any) {
	if (command.ownerOnly && !isOwner(member.id)) return false;
	if (command.userPermissions?.length > 0) {
		return command.userPermissions.every((perm: bigint) =>
			member.permissions.has(perm),
		);
	}

	return true;
}

export function getMissingBotPermissions(channel: any, permissions: any) {
	const botPerms = channel.guild.members.me.permissionsIn(channel);
	return permissions
		.filter((perm: bigint) => !botPerms.has(perm))
		.map((perm: bigint) => permissionNames.get(perm) || 'Unknown Permission');
}

export function inSameVoiceChannel(member: any, bot: any) {
	return (
		member.voice.channel &&
		bot.voice.channel &&
		member.voice.channelId === bot.voice.channelId
	);
}

export function isUserPremium(userId: any) {
	return db.isUserPremium(userId);
}

export function isGuildPremium(guildId: any) {
	return db.isGuildPremium(guildId);
}

export function hasAnyPremium(userId: any, guildId: any) {
	return db.hasAnyPremium(userId, guildId);
}

export function hasPremiumAccess(userId: string, guildId: string, type: 'user' | 'guild' | 'any' = 'any') {
	switch (type) {
		case 'user':
			return !!isUserPremium(userId);
		case 'guild':
			return !!isGuildPremium(guildId);
		case 'any':
		default:
			return !!hasAnyPremium(userId, guildId);
	}
}

export function getPremiumStatus(userId: any, guildId: any) {
	const userPremium = isUserPremium(userId);
	const guildPremium = isGuildPremium(guildId);

	return {
		hasUserPremium: !!userPremium,
		hasGuildPremium: !!guildPremium,
		hasAnyPremium: !!(userPremium || guildPremium),
		userPremium: userPremium || null,
		guildPremium: guildPremium || null,
		activePremium: userPremium || guildPremium || null,
	};
}

export function formatPremiumExpiry(expiresAt: any) {
	if (!expiresAt) return 'Never (Permanent)';

	const timeLeft = expiresAt - Date.now();
	if (timeLeft <= 0) return 'Expired';

	const days = Math.floor(timeLeft / 86400000);
	if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;

	const hours = Math.floor(timeLeft / 3600000);
	if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;

	const minutes = Math.floor(timeLeft / 60000);
	return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
