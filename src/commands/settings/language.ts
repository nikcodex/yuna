import { Command } from "#core/Command";
import { MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { buildContainer, buildSuccess, buildError } from "#ui/Theme";
import { db } from "#database/Database";
import { i18n } from "#utils/i18n.js";
import { logger } from "#utils/logger";
import emoji from "#config/emoji";

class LanguageCommand extends Command {
	constructor() {
		super({
			name: "language",
			description: "Change the language Yuna uses to speak to you",
			usage: "language",
			aliases: ["lang", "locale"],
			category: "settings",
			examples: ["language"],
			cooldown: 5,
			slash: {
				enabled: true,
				autoDefer: true,
				data: {
					name: "language",
					description: "Change the language Yuna uses to speak to you",
				},
			},
		});
	}

	async execute(ctx: any) {
		const { client, message, interaction, user, author } = ctx;
		const context = interaction || message;
		const userId = user?.id || author?.id;

		const currentLocaleCode = db.users.getLocale(userId) || "en-US";
		const currentMeta = i18n.getLocaleMeta(currentLocaleCode) || i18n.getLocaleMeta("en-US");

		// Build the dropdown options
		const locales = i18n.getLocales();
		const options: any[] = [];
		locales.forEach((data, code) => {
			options.push({
				label: data.meta.nativeName || code,
				description: `Set language to ${data.meta.name}`,
				value: code,
				emoji: data.meta.emoji || "🌐",
				default: code === currentLocaleCode,
			});
		});

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId("lang_select")
			.setPlaceholder("Select a language...")
			.addOptions(options);

		const row1 = new ActionRowBuilder().addComponents(selectMenu);

		const content = `**Your current language:** ${currentMeta?.emoji} **${currentMeta?.nativeName}**\n\nSelect a new language from the dropdown menu below to see a preview of how Yuna will speak to you.`;

		const initialContainer = buildContainer({
			title: "Language Settings",
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

		this._setupCollector(msgInstance, userId);
	}

	async slashExecute(ctx: any) {
		return this.execute(ctx);
	}

	_setupCollector(messageInstance: any, userId: string) {
		const collector = messageInstance.createMessageComponentCollector({
			filter: (i: any) => i.user.id === userId,
			time: 120_000,
		});

		let selectedLocaleCode = "";

		collector.on("collect", async (interaction: any) => {
			try {
				if (interaction.customId === "lang_select") {
					selectedLocaleCode = interaction.values[0];
					const meta = i18n.getLocaleMeta(selectedLocaleCode);

					// Generate a preview using old language vs new language
					const currentLocaleCode = db.users.getLocale(userId) || "en-US";
					const oldPreview = i18n.t(currentLocaleCode, "languagePreviewTest");
					const newPreview = i18n.t(selectedLocaleCode, "languagePreviewTest");

					const previewContent = `**UI Preview:**\n> 🇺🇸 "${oldPreview}"\n> ⬇️\n> ${meta?.emoji} "${newPreview}"\n\nDo you want to save these changes?`;

					const previewContainer = buildContainer({
						title: "Preview Language",
						content: previewContent,
						icon: meta?.emoji || "🌐",
					});

					const btnRow = new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId("lang_confirm").setLabel("Yes").setStyle(ButtonStyle.Success),
						new ButtonBuilder().setCustomId("lang_cancel").setLabel("No").setStyle(ButtonStyle.Danger)
					);

					await interaction.update({
						components: [previewContainer, btnRow],
						flags: MessageFlags.IsComponentsV2,
					});
				} else if (interaction.customId === "lang_confirm") {
					db.users.setLocale(userId, selectedLocaleCode);
					const successMsg = i18n.t(selectedLocaleCode, "languageSuccess");
					
					const successContainer = buildSuccess(successMsg, "Success");
					
					await interaction.update({
						components: [successContainer],
						flags: MessageFlags.IsComponentsV2,
					});
					collector.stop("confirmed");
				} else if (interaction.customId === "lang_cancel") {
					await interaction.update({
						components: [buildError("Language change cancelled.")],
						flags: MessageFlags.IsComponentsV2,
					});
					collector.stop("cancelled");
				}
			} catch (error) {
				logger.error("LanguageCommand", "Error in collector", error);
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

export default new LanguageCommand();
