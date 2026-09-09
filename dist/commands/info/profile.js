import { Command } from '#core/Command';
import { db } from "#database/Database";
import { MessageFlags, AttachmentBuilder } from "discord.js";
import { buildError } from "#ui/Theme";
import ProfileCard from "#ui/cards/ProfileCard";
class ProfileCommand extends Command {
    constructor() {
        super({
            name: "profile",
            description: "View your user profile, coins, and premium status",
            usage: "profile",
            aliases: ["me", "mypremium", "status"],
            category: "info",
            slash: {
                enabled: true,
                data: {
                    name: "profile",
                    description: "View your user profile, coins, and premium status"
                }
            }
        });
    }
    async execute(ctx) {
        const user = ctx.message ? ctx.message.author : ctx.interaction.user;
        return this._sendProfile(user, ctx.message || ctx.interaction);
    }
    async slashExecute(ctx) {
        return this.execute(ctx);
    }
    async _sendProfile(user, context) {
        const userId = user.id;
        // Fetch user data
        const coins = db.economy ? db.economy.getCoins(userId) : 0;
        const premium = db.premium ? db.premium.isUserPremium(userId) : null;
        let stats = { total_tracks_played: 0, total_listen_time_ms: 0 };
        if (db.stats) {
            const report = db.stats.getFullReport(userId, "all");
            if (report && report.aggregate) {
                stats = report.aggregate;
            }
        }
        const profileData = {
            coins,
            premium,
            stats
        };
        try {
            const cardGenerator = new ProfileCard();
            const buffer = await cardGenerator.createProfileCard(user, profileData);
            const attachment = new AttachmentBuilder(buffer, { name: "yuna-profile.png" });
            const payload = {
                files: [attachment],
                flags: MessageFlags.IsComponentsV2
            };
            if (context.replied || context.deferred) {
                return context.editReply(payload);
            }
            else if (typeof context.reply === "function") {
                return context.reply(payload);
            }
            else {
                return context.channel.send(payload);
            }
        }
        catch (err) {
            const errorContainer = buildError(`Failed to generate profile card: ${err.message}`, "Profile Error");
            const payload = { components: [errorContainer], flags: MessageFlags.IsComponentsV2 };
            if (context.replied || context.deferred) {
                return context.editReply(payload);
            }
            else if (typeof context.reply === "function") {
                return context.reply(payload);
            }
            else {
                return context.channel.send(payload);
            }
        }
    }
}
export default new ProfileCommand();
