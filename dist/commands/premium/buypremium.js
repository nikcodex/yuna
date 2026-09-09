import { Command } from '#core/Command';
import { db } from "#database/Database";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError, buildSuccess } from "#ui/Theme";
import emoji from "#config/emoji";
import phrases from "#utils/phrases";
const PRICES = {
    "1h": 100,
    "1d": 1000,
    "1w": 5000,
    "1m": 15000,
    "1y": 100000
};
const DURATIONS_MS = {
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
    "1m": 30 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000
};
class BuyPremiumCommand extends Command {
    constructor() {
        super({
            name: "buypremium",
            description: "Buy premium using your coins",
            usage: "buypremium <1h|1d|1w|1m|1y>",
            aliases: ["buyprem"],
            category: "premium",
            slash: {
                enabled: true,
                data: {
                    name: "buypremium",
                    description: "Buy premium using your coins",
                    options: [
                        {
                            name: "duration",
                            description: "The duration of premium to buy",
                            type: 3,
                            required: false,
                            choices: [
                                { name: "1 Hour (100 coins)", value: "1h" },
                                { name: "1 Day (1,000 coins)", value: "1d" },
                                { name: "1 Week (5,000 coins)", value: "1w" },
                                { name: "1 Month (15,000 coins)", value: "1m" },
                                { name: "1 Year (100,000 coins)", value: "1y" }
                            ]
                        }
                    ]
                }
            }
        });
    }
    async slashExecute({ interaction }) {
        const duration = interaction.options.getString("duration");
        const user = interaction.user;
        const userId = user.id;
        if (!duration) {
            return this._sendPricing(interaction, user);
        }
        // @ts-ignore
        const price = PRICES[duration];
        const userCoins = db.economy ? db.economy.getCoins(userId) : 0;
        if (userCoins < price) {
            return this._sendError(interaction, user, "Insufficient Coins", `You need **${price}** coins to buy **${duration}** premium, but you only have **${userCoins}** coins.`);
        }
        const removed = db.economy.removeCoins(userId, price);
        if (!removed) {
            return this._sendError(interaction, user, "Transaction Failed", "Failed to deduct coins. Please try again.");
        }
        if (db.premium.isUserPremium(userId)) {
            // @ts-ignore
            db.premium.extendPremium('user', userId, DURATIONS_MS[duration]);
        }
        else {
            // @ts-ignore
            const expiresAt = Date.now() + DURATIONS_MS[duration];
            db.premium.grantUserPremium(userId, "System", expiresAt, `Purchased with ${price} coins for ${duration}`);
        }
        return this._sendSuccess(interaction, user, `Successfully bought ${duration} of Premium for ${price} coins! Enjoy your perks!`);
    }
    async execute({ client: Client, message: Message, args }) {
        if (args.length < 1) {
            // @ts-ignore
            return this._sendPricing(message);
        }
        const duration = args[0].toLowerCase();
        // @ts-ignore
        if (!PRICES[duration]) {
            // @ts-ignore
            return this._sendError(message, "Invalid Duration", `Please provide a valid duration: \`1h\`, \`1d\`, \`1w\`, \`1m\`, or \`1y\``);
        }
        // @ts-ignore
        const userId = message.author.id;
        // @ts-ignore
        const price = PRICES[duration];
        const userCoins = db.economy ? db.economy.getCoins(userId) : 0;
        if (userCoins < price) {
            // @ts-ignore
            return this._sendError(message, "Insufficient Coins", `You need **${price}** coins to buy **${duration}** premium, but you only have **${userCoins}** coins.`);
        }
        const removed = db.economy.removeCoins(userId, price);
        if (!removed) {
            // @ts-ignore
            return this._sendError(message, "Transaction Failed", "Failed to deduct coins. Please try again.");
        }
        if (db.premium.isUserPremium(userId)) {
            // @ts-ignore
            db.premium.extendPremium('user', userId, DURATIONS_MS[duration]);
        }
        else {
            // @ts-ignore
            const expiresAt = Date.now() + DURATIONS_MS[duration];
            db.premium.grantUserPremium(userId, "System", expiresAt, `Purchased with ${price} coins for ${duration}`);
        }
        // @ts-ignore
        return this._sendSuccess(message, `Successfully bought ${duration} of Premium for ${price} coins! Enjoy your perks!`);
    }
    // @ts-ignore
    _sendPricing(context, user = context.author) {
        let content = "**Available Durations & Prices:**\n\n";
        content += "└─ \`1h\` (1 Hour) - **100 Coins**\n";
        content += "└─ \`1d\` (1 Day) - **1,000 Coins**\n";
        content += "└─ \`1w\` (1 Week) - **5,000 Coins**\n";
        content += "└─ \`1m\` (1 Month) - **15,000 Coins**\n";
        content += "└─ \`1y\` (1 Year) - **100,000 Coins**\n\n";
        content += "*Usage: `buypremium <duration>`*";
        const container = buildContainer({
            title: "Premium Store",
            content: content,
            thumbnail: user.displayAvatarURL(),
            icon: emoji.get("folder") || '💎'
        });
        const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
        // @ts-ignore
        if (context.editReply && (context.deferred || context.replied))
            return context.editReply(payload);
        else if (context.reply)
            return context.reply(payload);
        else
            return context.channel.send(payload);
    }
    // @ts-ignore
    _sendError(context, user = context.author, title, description) {
        if (typeof user === 'string') {
            description = title;
            title = user;
            user = context.author || context.user;
        }
        const container = buildError(description, title);
        const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
        // @ts-ignore
        if (context.editReply && (context.deferred || context.replied))
            return context.editReply(payload);
        else if (context.reply)
            return context.reply(payload);
        else
            return context.channel.send(payload);
    }
    // @ts-ignore
    _sendSuccess(context, user = context.author, description) {
        if (typeof user === 'string') {
            description = user;
            user = context.author || context.user;
        }
        const note = phrases.get("premiumSuccess");
        const container = buildSuccess(`${description}\n\n*${note}*`, "Purchase Successful");
        const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
        // @ts-ignore
        if (context.editReply && (context.deferred || context.replied))
            return context.editReply(payload);
        else if (context.reply)
            return context.reply(payload);
        else
            return context.channel.send(payload);
    }
}
export default new BuyPremiumCommand();
