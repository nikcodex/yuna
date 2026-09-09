import { Command } from '#core/Command';
import { db } from "#database/Database";
import { MessageFlags } from "discord.js";
import { buildContainer, buildError } from "#ui/Theme";
import emoji from "#config/emoji";
class LeaderboardCommand extends Command {
    constructor() {
        super({
            name: "leaderboard",
            description: "View the top listeners and wealthiest users!",
            usage: "leaderboard",
            aliases: ["lb", "top"],
            category: "info",
            slash: {
                enabled: true,
                data: {
                    name: "leaderboard",
                    description: "View the top listeners and wealthiest users!"
                }
            }
        });
    }
    async execute({ client: Client, message }) {
        // @ts-ignore
        return this._handleLeaderboard(message, client, message.author);
    }
    async slashExecute({ client: Client, interaction }) {
        // @ts-ignore
        return this._handleLeaderboard(interaction, client, interaction.user);
    }
    // @ts-ignore
    async _handleLeaderboard(context, client, user) {
        if (!db.economy) {
            const container = buildError("Economy system is currently offline.", "Economy Offline");
            // @ts-ignore
            return (context.replied || context.deferred) ? context.followUp({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true }) : context.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }
        const topUsers = db.economy.getTopUsers(10);
        if (topUsers.length === 0) {
            const container = buildError("The leaderboard is currently empty. Start listening to music to earn coins!", "Leaderboard Empty");
            // @ts-ignore
            return (context.replied || context.deferred) ? context.followUp({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true }) : context.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }
        let content = "";
        const medals = ["🥇", "🥈", "🥉"];
        for (let i = 0; i < topUsers.length; i++) {
            const dbUser = topUsers[i];
            let username = "Unknown User";
            try {
                const fetchUser = await client.users.fetch(dbUser.user_id);
                if (fetchUser)
                    username = fetchUser.username;
            }
            catch (e) {
            }
            const rankStr = i < 3 ? medals[i] : `#${i + 1}`;
            content += `${rankStr} **${username}** — **${dbUser.coins.toLocaleString()}** Coins\n`;
        }
        const userCoins = db.economy.getCoins(user.id);
        content += `\n└─ **You** currently have **${userCoins.toLocaleString()}** coins.`;
        const container = buildContainer({
            title: "Global Leaderboard (Top Listeners)",
            content: content,
            thumbnail: client.user.displayAvatarURL(),
            icon: emoji.get("music") || '🏆'
        });
        const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
        if (context.replied || context.deferred) {
            return context.editReply?.(payload);
        }
        else if (typeof context.reply === "function") {
            return context.reply(payload);
        }
        else {
            return context.channel.send(payload);
        }
    }
}
export default new LeaderboardCommand();
