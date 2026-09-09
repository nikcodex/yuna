import { QueueManager } from './QueueManager.js';
import { config } from '#config/config';
import { db } from '#database/Database';
import { logger } from '#utils/logger';
export class PlayerManager {
    player;
    guildId;
    queue;
    constructor(player) {
        if (!player)
            throw new Error("PlayerManager requires a valid player instance.");
        this.player = player;
        this.guildId = player.guildId;
        this.queue = new QueueManager(player);
    }
    async connect() { await this.player.connect(); return this; }
    async disconnect(force = false) {
        if (this.player.destroy) {
            this.player.destroy(force ? 'Force disconnect' : 'Disconnect');
        }
        return this;
    }
    async destroy(reason, disconnect = true) {
        this.player.destroy(reason || 'Destroyed');
        return this;
    }
    addTracks(tracks, position) {
        return this.queue.add(tracks, position);
    }
    is247ModeEnabled() {
        const settings = db.guild?.get247Settings(this.guildId);
        return settings?.enabled === true;
    }
    async play(options = {}) {
        if (!options.clientTrack && !options.track && this.player.queue.tracks.length > 0) {
            const nextTrack = this.player.queue.tracks.shift();
            await this.player.play({ clientTrack: nextTrack, ...options });
        }
        else if (options.track && !options.clientTrack) {
            await this.player.play({ clientTrack: options.track, ...options });
        }
        else {
            await this.player.play(options);
        }
        return this;
    }
    async playPrevious() {
        const prev = this.player.queue.previous;
        if (!prev || prev.length === 0)
            return false;
        const previousTrack = prev.pop();
        if (!previousTrack)
            return false;
        await this.player.play({ track: previousTrack });
        return true;
    }
    async pause() { await this.player.pause(); return this; }
    async resume() { await this.player.resume(); return this; }
    async stop() {
        const settings = db.guild?.get247Settings(this.guildId);
        const is247ModeEnabled = settings && settings.enabled === true;
        this.player.queue.tracks = [];
        if (!is247ModeEnabled) {
            this.player.destroy("Stop command");
        }
        else {
            this.player.audioPlayer?.stop(true);
            this.player.queue.current = null;
            this.player.playing = false;
        }
        return this;
    }
    async skip(amount = 1) {
        const { player } = this;
        const { current } = player.queue;
        if (player.repeatMode === "track" && current) {
            player.repeatMode = 'off';
        }
        if (amount > 1) {
            player.queue.tracks.splice(0, amount - 1);
        }
        player.audioPlayer?.stop(true);
        return this;
    }
    async seek(position) { await this.player.seek(position); return this; }
    async forward(amount = 10000) {
        const track = this.currentTrack;
        if (!track || track.info?.isStream)
            return false;
        const newPosition = Math.min(this.position + amount, track.info?.duration || 0);
        await this.seek(newPosition);
        return newPosition;
    }
    async rewind(amount = 10000) {
        const newPosition = Math.max(this.position - amount, 0);
        await this.seek(newPosition);
        return newPosition;
    }
    async replay() {
        await this.seek(0);
        return true;
    }
    async setVolume(volume) { this.player.setVolume(volume); return this; }
    async setRepeatMode(mode) { this.player.setRepeatMode(mode); return this; }
    async shuffleQueue() {
        await this.queue.shuffle();
        return this;
    }
    get isConnected() { return this.player.connected; }
    get isPlaying() { return this.player.playing; }
    get isPaused() { return this.player.paused; }
    get currentTrack() { return this.player.queue.current; }
    get position() { return this.player.position; }
    get volume() { return this.player.volume; }
    get queueSize() { return this.queue.size; }
    formatDuration(ms) {
        if (!ms || ms < 0)
            return "Live";
        const seconds = Math.floor((ms / 1000) % 60).toString().padStart(2, "0");
        const minutes = Math.floor((ms / (1000 * 60)) % 60).toString().padStart(2, "0");
        const hours = Math.floor(ms / (1000 * 60 * 60));
        return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
    }
    createProgressBar(current, total, length = 15) {
        if (!total || total <= 0)
            return "░".repeat(length);
        const progress = Math.max(0, Math.min(1, current / total));
        const filledBlocks = Math.round(progress * length);
        const emptyBlocks = length - filledBlocks;
        return "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
    }
    getBestImage(images) {
        if (!images || !Array.isArray(images))
            return config.assets?.defaultTrackArtwork || "";
        const sizeOrder = ["extralarge", "large", "medium", "small"];
        for (const size of sizeOrder) {
            const image = images.find((img) => img.size === size);
            if (image && image["#text"])
                return image["#text"];
        }
        const fallback = images.find((img) => img["#text"]);
        return fallback ? fallback["#text"] : config.assets?.defaultTrackArtwork || "";
    }
    saveSession() {
        try {
            if (!this.player || !this.player.voiceChannelId)
                return;
            const currentTrack = this.player.queue.current;
            const queueTracks = this.player.queue.tracks || [];
            const position = this.player.position || 0;
            if (!currentTrack && queueTracks.length === 0) {
                db.guild.deleteActiveSession(this.guildId);
                return;
            }
            db.guild.saveActiveSession(this.guildId, this.player.voiceChannelId, this.player.textChannelId, currentTrack, queueTracks, position);
        }
        catch (err) {
            logger.error('PlayerManager', `Failed to save session for guild ${this.guildId}:`, err);
        }
    }
    clearSession() {
        try {
            db.guild.deleteActiveSession(this.guildId);
        }
        catch (err) {
            logger.error('PlayerManager', `Failed to clear session for guild ${this.guildId}:`, err);
        }
    }
    toJSON() {
        return this.player.toJSON();
    }
}
