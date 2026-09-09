/**
 * @file AudioManager.ts
 * @description Central Audio Manager for Yuna V2 powered by KizunaLink (Lavalink v4 Drop-in).
 */
import { LavalinkManager } from 'lavalink-client';
import { config } from '#config/config';
import { logger } from '#utils/logger';
export class AudioManager {
    client;
    lavalink;
    constructor(client) {
        this.client = client;
        this.lavalink = new LavalinkManager({
            nodes: config.nodes.length > 0 ? config.nodes : [
                {
                    id: 'kizunalink-core',
                    host: process.env.LAVALINK_HOST || '127.0.0.1',
                    port: Number(process.env.LAVALINK_PORT) || 2333,
                    authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
                    secure: process.env.LAVALINK_SECURE === 'true',
                    retryAmount: 20,
                    retryDelay: 3000,
                }
            ],
            sendToShard: (guildId, payload) => {
                const guild = this.client.guilds.cache.get(guildId);
                if (guild?.shard) {
                    guild.shard.send(payload);
                }
                else if (this.client.ws?.shards) {
                    const shard = this.client.ws.shards.get(guild?.shardId ?? 0) || this.client.ws.shards.first();
                    if (shard)
                        shard.send(payload);
                }
            },
            client: {
                id: config.clientId || '1528943321974571098',
                username: config.botName || 'Yuna'
            },
            autoSkip: true,
            playerOptions: {
                clientBasedPositionUpdateInterval: 50,
                defaultSearchPlatform: 'jssearch',
                volumeDecrementer: 1
            },
            queueOptions: {
                maxPreviousTracks: 25
            }
        });
        this.init();
    }
    init() {
        this.client.once('clientReady', async () => {
            logger.info('AudioManager', `🌸 Connecting to KizunaLink Audio Core...`);
            this.lavalink.on("debug", (event, log) => {
                if (log.state === "warn" || log.state === "error") {
                    logger.warn("LavalinkDebug", log.message);
                }
            });
            const origFetch = global.fetch;
            global.fetch = async (url, options) => {
                if (url.toString().includes('2333')) {
                    logger.info('AudioManager', `FETCH OUTGOING: ${options.method} ${url}`);
                    if (options.body)
                        logger.info('AudioManager', `FETCH BODY: ${options.body}`);
                }
                try {
                    const res = await origFetch(url, options);
                    if (url.toString().includes('2333')) {
                        logger.info('AudioManager', `FETCH RESPONSE: ${res.status}`);
                    }
                    return res;
                }
                catch (e) {
                    logger.error('AudioManager', `FETCH ERROR: ${e}`, e);
                    throw e;
                }
            };
            try {
                if (this.lavalink.options?.client) {
                    this.lavalink.options.client.id = this.client.user.id;
                    this.lavalink.options.client.username = this.client.user.username;
                }
                await this.lavalink.init({
                    id: this.client.user.id,
                    username: this.client.user.username
                });
                this._patchNodeUpdatePlayer();
                logger.success('AudioManager', `⛩️ KizunaLink Audio Engine connected!`);
            }
            catch (err) {
                logger.error('AudioManager', `Failed to initialize KizunaLink node:`, err);
            }
        });
    }
    /**
     * Patches each Lavalink node's updatePlayer to transform the nested
     * { track: { encoded } } format into flat { encodedTrack } for KizunaLink.
     * lavalink-client sends Lavalink v4 REST spec but KizunaLink's current
     * binary reads `encodedTrack` as a flat string.
     */
    _patchNodeUpdatePlayer() {
        for (const node of this.lavalink.nodeManager.nodes.values()) {
            const originalRequest = node.request.bind(node);
            node.request = (endpoint, modify, isAutoSkip) => {
                return originalRequest(endpoint, (reqObj) => {
                    if (modify)
                        modify(reqObj);
                    if (reqObj.method === 'PATCH' && reqObj.body) {
                        try {
                            const body = JSON.parse(reqObj.body);
                            if (body.track?.encoded && !body.encodedTrack) {
                                body.encodedTrack = body.track.encoded;
                                logger.info('AudioManager', `Transformed track.encoded → encodedTrack for KizunaLink`);
                            }
                            reqObj.body = JSON.stringify(body);
                        }
                        catch (e) { }
                    }
                    // @ts-ignore
                }, isAutoSkip);
            };
        }
    }
    /**
     * Retrieves active player for guild
     * @param {string} guildId
     * @returns {import('lavalink-client').Player|undefined}
     */
    getPlayer(guildId) {
        return this.lavalink.getPlayer(guildId);
    }
    /**
     * Creates or returns an active player for a guild
     * @param {Object} options { guildId, voiceChannelId, textChannelId, volume, selfDeaf }
     * @returns {Promise<import('lavalink-client').Player>}
     */
    async createPlayer(options) {
        const { guildId, voiceChannelId, textChannelId, volume = 100, selfDeaf = true } = options;
        let player = this.lavalink.getPlayer(guildId);
        if (player) {
            if (voiceChannelId && player.voiceChannelId !== voiceChannelId) {
                player.voiceChannelId = voiceChannelId;
                await player.connect();
            }
            if (textChannelId)
                player.textChannelId = textChannelId;
            return player;
        }
        player = await this.lavalink.createPlayer({
            guildId,
            // @ts-ignore
            voiceChannelId,
            textChannelId,
            selfDeaf,
            volume
        });
        await player.connect();
        return player;
    }
    async search(query, options = {}) {
        if (!query || !query.trim()) {
            return { loadType: 'empty', tracks: [] };
        }
        const requester = options.requester || null;
        const cleanQuery = query.trim();
        const node = this.lavalink.nodeManager.leastUsedNodes()?.[0] || this.lavalink.nodeManager.nodes.values().next().value;
        if (!node) {
            throw new Error('No KizunaLink/Lavalink audio node available');
        }
        const isUrl = /^https?:\/\//i.test(cleanQuery);
        const searchOptions = isUrl
            ? { query: cleanQuery }
            : { query: cleanQuery, source: options.source || 'jssearch' };
        // @ts-ignore
        return await node.search(searchOptions, requester);
    }
    /**
     * Destroys a guild player
     * @param {string} guildId
     */
    async destroyPlayer(guildId) {
        return await this.lavalink.destroyPlayer(guildId);
    }
}
export default AudioManager;
