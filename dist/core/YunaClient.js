import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import { Client, GatewayIntentBits, Collection, Partials, REST } from 'discord.js';
import { config } from '#config/config';
import db from '#database/Database';
import { AudioManager } from '#audio/AudioManager';
import { CommandLoader } from '#loaders/CommandLoader';
import { EventLoader } from '#loaders/EventLoader';
import { ComponentLoader } from '#loaders/ComponentLoader';
import { logger } from '#utils/logger';
import ErrorHandler from '#core/ErrorHandler';
import { Scheduler } from '#core/Scheduler';
let shardInfo = null;
try {
    shardInfo = getInfo();
}
catch (error) {
    shardInfo = null;
}
export class YunaClient extends Client {
    cluster;
    commands;
    aliases;
    categories;
    logger;
    config;
    db;
    audio;
    components;
    commandLoader;
    eventLoader;
    scheduler;
    startTime;
    // @ts-ignore
    rest;
    constructor() {
        const clientOptions = {
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
            ],
            partials: [
                Partials.Channel,
                Partials.GuildMember,
                Partials.Message,
                Partials.User,
            ],
            makeCache: Client.prototype.options?.makeCache, // temporary fallback
            failIfNotExists: false,
            allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
        };
        if (shardInfo) {
            clientOptions.shards = shardInfo.SHARD_LIST;
            clientOptions.shardCount = shardInfo.TOTAL_SHARDS;
        }
        super(clientOptions);
        this.cluster = shardInfo ? new ClusterClient(this) : null;
        this.commands = new Collection();
        this.aliases = new Map();
        this.categories = new Map();
        this.logger = logger;
        this.config = config;
        this.db = db;
        this.audio = new AudioManager(this);
        this.components = new ComponentLoader(this);
        this.commandLoader = new CommandLoader(this);
        this.eventLoader = new EventLoader(this);
        this.scheduler = new Scheduler(this);
        this.startTime = Date.now();
        this.rest = new REST({ version: '10' }).setToken(config.token);
    }
    get music() {
        return this.audio;
    }
    get lavalink() {
        return this.audio?.lavalink;
    }
    get commandHandler() {
        return this.commandLoader;
    }
    get eventHandler() {
        return this.eventLoader;
    }
    async init() {
        this.logger.info('YunaClient', `Initializing Yuna V2 Sakura engine...`);
        try {
            await this.eventLoader.load();
            await this.commandLoader.load();
            await this.components.load();
            // Register persistent scheduled background tasks
            this.scheduler.every('db_checkpoint', { minutes: 15 }, () => this.db?.checkpoint?.());
            this.scheduler.every('db_backup', { hours: 6 }, () => this.db?.backup?.());
            await this.scheduler.init();
            if (config.token && config.token !== 'YOUR_BOT_TOKEN_HERE') {
                await this.login(config.token);
            }
            ErrorHandler.register(() => this.cleanup());
            this.logger.success('YunaClient', `Bot has successfully initialized.`);
        }
        catch (error) {
            this.logger.error('YunaClient', 'Failed to initialize bot:', error);
            throw error;
        }
    }
    async cleanup() {
        this.logger.warn('YunaClient', `Saving active player sessions before shutdown...`);
        try {
            if (this.scheduler) {
                this.scheduler.stop();
            }
            if (this.audio && this.audio.players) {
                for (const [guildId, player] of this.audio.players) {
                    if (player && player.voiceChannelId && (player.queue?.current || player.queue?.length > 0)) {
                        try {
                            const current = player.queue?.current;
                            const remaining = player.queue ? Array.from(player.queue) : [];
                            const pos = player.position || 0;
                            this.db.guild?.saveActiveSession?.(guildId, player.voiceChannelId, player.textChannelId, current, remaining, pos);
                            this.logger.info('YunaClient', `Saved active session state for guild ${guildId}`);
                        }
                        catch (e) { }
                    }
                    if (typeof player.destroy === 'function') {
                        await player.destroy();
                    }
                }
            }
            if (typeof this.db.closeAll === 'function') {
                await this.db.closeAll();
            }
            else if (typeof this.db.close === 'function') {
                await this.db.close();
            }
            this.destroy();
            this.logger.success('YunaClient', 'Cleanup completed successfully.');
        }
        catch (error) {
            this.logger.error('YunaClient', 'An error occurred during cleanup:', error);
        }
    }
    get uptime() {
        return Date.now() - this.startTime;
    }
}
