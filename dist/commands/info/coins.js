import { Command } from '#core/Command';
import { db } from "#database/Database";
import { MessageFlags } from "discord.js";
import { buildContainer } from "#ui/Theme";
import emoji from "#config/emoji";
class CoinsCommand extends Command {
    constructor() {
        super({
            name: "coins",
            description: "Check your current coin balance",
            usage: "coins",
            aliases: ["bal", "balance"],
            category: "info",
            slash: {
                enabled: true,
                data: {
                    name: "coins",
                    description: "Check your current coin balance"
                }
            }
        });
    }
    async execute({ client: Client, message: Message, args }) {
        // @ts-ignore
        const userId = message.author.id;
        const coins = db.economy ? db.economy.getCoins(userId) : 0;
        const container = buildContainer({
            title: "Your Balance",
            content: `You currently have **${coins}** coins.\n\n*Tip: You earn 5 coins per minute listening to music and 1 coin per command used!*`,
            // @ts-ignore
            thumbnail: message.author.displayAvatarURL(),
            icon: emoji.get("add") || '💰'
        });
        // @ts-ignore
        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
    async slashExecute({ interaction }) {
        const userId = interaction.user.id;
        const coins = db.economy ? db.economy.getCoins(userId) : 0;
        const container = buildContainer({
            title: "Your Balance",
            content: `You currently have **${coins}** coins.\n\n*Tip: You earn 5 coins per minute listening to music and 1 coin per command used!*`,
            thumbnail: interaction.user.displayAvatarURL(),
            icon: emoji.get("add") || '💰'
        });
        return interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
}
export default new CoinsCommand();
