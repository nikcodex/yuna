import { logger } from '#utils/logger';

import { Client, Interaction } from "discord.js";

export class ComponentLoader {
  client: any;
  handlers: Map<any, any>;

    constructor(client: Client) {
        this.client = client;
        this.handlers = new Map();
    }

    async load() {
        return Promise.resolve();
    }

    register(pattern: any, handler: any, options: any = {}) {
        this.handlers.set(pattern, { handler, options });
    }

    async handle(interaction: Interaction | any) {
        if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;

        let matchedHandler = null;
        let matchedOptions = null;

        for (const [pattern, data] of this.handlers.entries()) {
            if (pattern instanceof RegExp && pattern.test(interaction.customId)) {
                matchedHandler = data.handler;
                matchedOptions = data.options;
                break;
            } else if (typeof pattern === 'string' && interaction.customId.startsWith(pattern)) {
                matchedHandler = data.handler;
                matchedOptions = data.options;
                break;
            }
        }

        if (!matchedHandler) return;

        try {
            if (matchedOptions.defer) {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
            }

            if (matchedOptions.sameUser && interaction.message?.interaction?.user?.id && interaction.user.id !== interaction.message.interaction.user.id) {
                const msg = 'This button is not for you.';
                if (interaction.deferred) return interaction.editReply({ content: msg });
                return interaction.reply({ content: msg, ephemeral: true });
            }

            if (matchedOptions.sameVoice) {
                const memberVoice = interaction.member?.voice?.channel;
                const botVoice = interaction.guild?.members?.me?.voice?.channel;
                if (!memberVoice || (botVoice && memberVoice.id !== botVoice.id)) {
                    const msg = 'You must be in the same voice channel as me.';
                    if (interaction.deferred) return interaction.editReply({ content: msg });
                    return interaction.reply({ content: msg, ephemeral: true });
                }
            }

            await matchedHandler(interaction, this.client);
        } catch (error) {
            logger.error('ComponentLoader', `Error handling component: ${interaction.customId}`, error);
        }
    }
}
