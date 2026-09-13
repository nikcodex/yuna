import { Command } from "#core/Command";
import { MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { buildContainer, buildSuccess, buildError } from "#ui/Theme";
import { db } from "#database/Database";
import { i18n } from "#utils/i18n.js";
import { logger } from "#utils/logger";

class ServerLanguageCommand extends Command {
	constructor() {
		super({
			name: "server-language",
			description: "Change the default language Yuna uses for this entire server",
			usage: "server-language",
			aliases: ["serverlang", "serverlocale"],
			category: "settings",
			slash: {
				enabled: true,
				autoDefer: true,
				data: {
					name: "server-language",
					description: "Change the default language Yuna uses for this entire server",
				},
			},
		});
	}

	async execute(ctx: any) {
		const { message, interaction, guild, user, author } = ctx;
		const context = interaction || message;
		const userId = user?.id || author?.id;
		const guildId = guild?.id;

		if (!guildId) {
			return ctx.replyError ? ctx.replyError("This command can only be used in a server.") : null;
		}

		if (guild.ownerId !== userId) {
			const errContainer = buildError("Only the **Server Owner** can change the default server language.", "Access Denied");
			const payload = { components: [errContainer], flags: MessageFlags.IsComponentsV2 };
			if (context.replied || context.deferred) return context.editReply(payload);
			if (typeof context.reply === "function") return context.reply(payload);
			return context.channel.send(payload);
		}

		const currentLocaleCode = db.guilds.getLocale(guildId) || "en-US";
		const currentMeta = i18n.getLocaleMeta(currentLocaleCode) || i18n.getLocaleMeta("en-US");

		const locales = i18n.getLocales();
		const options: any[] = [];
		locales.forEach((data, code) => {
			options.push({
				label: data.meta.nativeName || code,
				description: `Set server language to ${data.meta.name}`,
				value: code,
				emoji: data.meta.emoji || "🌐",
				default: code === currentLocaleCode,
			});
		});

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId("server_lang_select")
			.setPlaceholder("Select a server language...")
			.addOptions(options);

		const row1 = new ActionRowBuilder().addComponents(selectMenu);

		const content = `**Current Server Language:** ${currentMeta?.emoji} **${currentMeta?.nativeName}**\n\nSelect a new default language from the dropdown menu below to change how Yuna speaks to everyone in this server. (Users can still override this with \`/language\`).`;

		const initialContainer = buildContainer({
			title: "Server Language Settings",
			content: content,
			icon: "🌐",
		});

		const payload = {
			components: [initialContainer, row1],
			flags: MessageFlags.IsComponentsV2,
			fetchReply: true,
		};

		let msgInstance;
		if (context.replied || context.deferred) {
			msgInstance = await context.editReply(payload);
		} else if (typeof context.reply === "function") {
			msgInstance = await context.reply(payload);
		} else {
			msgInstance = await context.channel.send(payload);
		}

		this._setupCollector(msgInstance, userId, guildId);
	}

	async slashExecute(ctx: any) {
		return this.execute(ctx);
	}

	_setupCollector(messageInstance: any, userId: string, guildId: string) {
		const collector = messageInstance.createMessageComponentCollector({
			filter: (i: any) => i.user.id === userId,
			time: 120_000,
		});

		let selectedLocaleCode = "";

		collector.on("collect", async (interaction: any) => {
			try {
				if (interaction.customId === "server_lang_select") {
					selectedLocaleCode = interaction.values[0];
					const meta = i18n.getLocaleMeta(selectedLocaleCode);

					const currentLocaleCode = db.guilds.getLocale(guildId) || "en-US";
					const oldPreview = i18n.t(currentLocaleCode, "languagePreviewTest");
					const newPreview = i18n.t(selectedLocaleCode, "languagePreviewTest");

					const previewContent = `**UI Preview:**\n> 🇺🇸 "${oldPreview}"\n> ⬇️\n> ${meta?.emoji} "${newPreview}"\n\nDo you want to save this language as the default for the entire server?`;

					const previewContainer = buildContainer({
						title: "Preview Server Language",
						content: previewContent,
						icon: meta?.emoji || "🌐",
					});

					const btnRow = new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId("server_lang_confirm").setLabel("Yes, Apply to Server").setStyle(ButtonStyle.Success),
						new ButtonBuilder().setCustomId("server_lang_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger)
					);

					await interaction.update({
						components: [previewContainer, btnRow],
						flags: MessageFlags.IsComponentsV2,
					});
				} else if (interaction.customId === "server_lang_confirm") {
					db.guilds.setLocale(guildId, selectedLocaleCode);
					const successMsg = i18n.t(selectedLocaleCode, "languageSuccess");

					const successContainer = buildSuccess(successMsg, "Server Language Updated");

					await interaction.update({
						components: [successContainer],
						flags: MessageFlags.IsComponentsV2,
					});
					collector.stop("confirmed");
				} else if (interaction.customId === "server_lang_cancel") {
					await interaction.update({
						components: [buildError("Server language change cancelled.")],
						flags: MessageFlags.IsComponentsV2,
					});
					collector.stop("cancelled");
				}
			} catch (error) {
				logger.error("ServerLanguageCommand", "Error in collector", error);
			}
		});

		collector.on("end", async (collected: any, reason: string) => {
			if (reason === "time") {
				try {
					await messageInstance.edit({
						components: [buildError("Menu timed out.")],
						flags: MessageFlags.IsComponentsV2,
					});
				} catch (e) {}
			}
		});
	}
}

export default new ServerLanguageCommand();

// Made by Nikhil Under CodeX Devs
