// @ts-ignore
import BetterSqlite3 from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '#utils/logger';
import { GuildRepo } from './repositories/GuildRepo.js';
import { UserRepo } from './repositories/UserRepo.js';
import { PremiumRepo } from './repositories/PremiumRepo.js';
import { PlaylistRepo } from './repositories/PlaylistRepo.js';
import { EconomyRepo } from './repositories/EconomyRepo.js';
import { LikedRepo } from './repositories/LikedRepo.js';
import { StatsRepo } from './repositories/StatsRepo.js';
import { up as migration001 } from './migrations/001_initial.js';
export class Database {
    dbPath;
    db;
    guilds;
    users;
    premium;
    playlists;
    economy;
    liked;
    stats;
    constructor() {
        this.dbPath = path.join(process.cwd(), 'database', 'yuna.yuna');
        fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
        try {
            this.db = new BetterSqlite3(this.dbPath, {
                // @ts-ignore
                verbose: process.env.NODE_ENV === 'development' ? (msg) => logger.debug('Database', msg) : null,
            });
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('temp_store = MEMORY');
            this.db.pragma('busy_timeout = 5000');
            this.db.pragma('mmap_size = 268435456');
            this.db.pragma('cache_size = -64000');
            this.db.pragma('foreign_keys = ON');
            this._runMigrations();
            this.guilds = new GuildRepo(this.db);
            this.users = new UserRepo(this.db);
            this.premium = new PremiumRepo(this.db);
            this.playlists = new PlaylistRepo(this.db);
            this.economy = new EconomyRepo(this.db);
            this.liked = new LikedRepo(this.db);
            this.stats = new StatsRepo(this.db);
            logger.success('Database', 'Unified database initialized successfully');
        }
        catch (error) {
            logger.error('Database', 'Failed to initialize unified database', error);
            throw error;
        }
    }
    _runMigrations() {
        let currentVersion = this.db.pragma('user_version', { simple: true });
        if (currentVersion === 0) {
            logger.info('Database', 'Running initial migration (001_initial)...');
            this.db.transaction(() => {
                migration001(this.db);
                this.db.pragma('user_version = 1');
            })();
            logger.success('Database', 'Migration 001_initial applied successfully.');
        }
    }
    checkpoint() {
        try {
            this.db.pragma('wal_checkpoint(TRUNCATE)');
            logger.debug('Database', 'WAL checkpoint (TRUNCATE) completed');
        }
        catch (error) {
            logger.error('Database', 'Failed to checkpoint WAL', error);
        }
    }
    close() {
        try {
            this.checkpoint();
            this.db.close();
            logger.info('Database', 'Database connection closed');
        }
        catch (error) {
            logger.error('Database', 'Failed to close database connection', error);
        }
    }
    backup() {
        try {
            const backupDir = path.resolve(process.cwd(), 'backups');
            if (!fs.existsSync(backupDir))
                fs.mkdirSync(backupDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `${timestamp}-yuna.yuna`);
            this.db.backup(backupPath)
                .then(() => {
                logger.info('Backup', `Database backup completed${backupPath}`);
            })
                .catch((err) => {
                logger.error('Backup', 'Failed to backup database', err);
            });
        }
        catch (error) {
            logger.error('Backup', 'Failed to initialize database backup', error);
        }
    }
    get guild() { return this.guilds; }
    get user() { return this.users; }
    isUserBlacklisted(userId) { return this.users.isBlacklisted(userId); }
    isGuildBlacklisted(guildId) { return this.guilds.isBlacklisted(guildId); }
    getPrefixes(guildId) { return this.guilds.getPrefixes(guildId); }
    getUserPrefixes(userId) { return this.users.getCustomPrefixes(userId); }
    isUserPremium(userId) { return this.premium.isUserPremium(userId); }
    isGuildPremium(guildId) { return this.premium.isGuildPremium(guildId); }
    hasAnyPremium(userId, guildId) { return this.premium.hasAnyPremium ? this.premium.hasAnyPremium(userId, guildId) : (this.isUserPremium(userId) || this.isGuildPremium(guildId)); }
    getNpStyle(userId) { return this.users.getNpStyle ? this.users.getNpStyle(userId) : 'card'; }
    setNpStyle(userId, style) { return this.users.setNpStyle(userId, style); }
    getDefaultVolume(guildId) { return this.guilds.getDefaultVolume ? this.guilds.getDefaultVolume(guildId) : 100; }
    getValid247Guilds() { return this.guilds.getValid247Guilds(); }
    set247Mode(guildId, enabled, voiceChannelId = null, textChannelId = null) { return this.guilds.set247Mode(guildId, enabled, voiceChannelId, textChannelId); }
    hasNoPrefix(userId) { return typeof this.users?.hasNoPrefix === 'function' ? this.users.hasNoPrefix(userId) : false; }
    backupDatabases() { return this.backup(); }
    checkpointWAL() { return this.checkpoint(); }
}
export const db = new Database();
export default db;
