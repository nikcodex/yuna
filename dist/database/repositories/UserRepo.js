import { logger } from '#utils/logger';
const HISTORY_LIMIT = 10;
const USER_PREFIX_LIMIT = 3;
export class UserRepo {
    db;
    _getUser;
    _ensureUser;
    _updateNoPrefix;
    _updateNpStyle;
    _updateAutoplayCooldown;
    _updatePrefixes;
    _updateBlacklist;
    _updateHistory;
    _updateSpotify;
    _unlinkSpotify;
    constructor(db) {
        this.db = db;
        this._getUser = this.db.prepare('SELECT * FROM users WHERE id = ?');
        this._ensureUser = this.db.prepare('INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO NOTHING');
        this._updateNoPrefix = this.db.prepare('UPDATE users SET no_prefix = ?, no_prefix_expiry = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        this._updateNpStyle = this.db.prepare('UPDATE users SET np_style = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        this._updateAutoplayCooldown = this.db.prepare('UPDATE users SET autoplay_cooldown = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        this._updatePrefixes = this.db.prepare('UPDATE users SET custom_prefixes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        // @ts-ignore
        this._updateLocale = this.db.prepare('UPDATE users SET locale = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        this._updateBlacklist = this.db.prepare('UPDATE users SET blacklisted = ?, blacklist_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        this._updateHistory = this.db.prepare('UPDATE users SET history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        this._updateSpotify = this.db.prepare('UPDATE users SET spotify_profile_url = ?, spotify_display_name = ?, spotify_linked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        this._unlinkSpotify = this.db.prepare('UPDATE users SET spotify_profile_url = NULL, spotify_display_name = NULL, spotify_linked_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    }
    /**
     * Retrieves user data
     * @param {string} userId
     * @returns {Object|null}
     */
    getUser(userId) {
        return this._getUser.get(userId);
    }
    /**
     * Ensures a user exists in the database
     * @param {string} userId
     * @returns {Object}
     */
    ensureUser(userId) {
        let user = this.getUser(userId);
        if (!user) {
            this._ensureUser.run(userId);
            user = this.getUser(userId);
        }
        return user;
    }
    /**
     * Sets no prefix mode for a user
     * @param {string} userId
     * @param {boolean} enabled
     * @param {number|null} expiryTimestamp
     */
    setNoPrefix(userId, enabled, expiryTimestamp = null) {
        this.ensureUser(userId);
        this._updateNoPrefix.run(enabled ? 1 : 0, expiryTimestamp, userId);
    }
    /**
     * Checks if a user has no prefix enabled
     * @param {string} userId
     * @returns {boolean}
     */
    hasNoPrefix(userId) {
        const user = this.getUser(userId);
        if (!user || !user.no_prefix)
            return false;
        if (!user.no_prefix_expiry)
            return true;
        if (user.no_prefix_expiry > Date.now())
            return true;
        this.setNoPrefix(userId, false, null);
        return false;
    }
    /**
     * Retrieves np style
     * @param {string} userId
     * @returns {string}
     */
    getNpStyle(userId) {
        const user = this.getUser(userId);
        return user?.np_style || 'card';
    }
    /**
     * Sets np style
     * @param {string} userId
     * @param {string} style
     */
    setNpStyle(userId, style) {
        this.ensureUser(userId);
        this._updateNpStyle.run(style, userId);
    }
    /**
     * Sets autoplay cooldown
     * @param {string} userId
     * @param {number} cooldownTimestamp
     */
    setAutoplayCooldown(userId, cooldownTimestamp) {
        this.ensureUser(userId);
        this._updateAutoplayCooldown.run(cooldownTimestamp, userId);
    }
    /**
     * Retrieves autoplay cooldown
     * @param {string} userId
     * @returns {number}
     */
    getAutoplayCooldown(userId) {
        const user = this.getUser(userId);
        if (!user || !user.autoplay_cooldown)
            return 0;
        return user.autoplay_cooldown > Date.now() ? user.autoplay_cooldown : 0;
    }
    /**
     * Retrieves user custom prefixes
     * @param {string} userId
     * @returns {Array<string>}
     */
    getUserPrefixes(userId) {
        const user = this.getUser(userId);
        if (!user || !user.custom_prefixes)
            return [];
        try {
            return JSON.parse(user.custom_prefixes);
        }
        catch {
            return [];
        }
    }
    getCustomPrefixes(userId) {
        return this.getUserPrefixes(userId);
    }
    /**
     * Sets user custom prefixes
     * @param {string} userId
     * @param {Array<string>} prefixes
     */
    setUserPrefixes(userId, prefixes) {
        this.ensureUser(userId);
        const limitedPrefixes = prefixes.slice(0, USER_PREFIX_LIMIT);
        this._updatePrefixes.run(JSON.stringify(limitedPrefixes), userId);
    }
    /**
     * Blacklists a user
     * @param {string} userId
     * @param {string} reason
     */
    blacklistUser(userId, reason = 'No reason provided') {
        this.ensureUser(userId);
        this._updateBlacklist.run(1, reason, userId);
    }
    /**
     * Unblacklists a user
     * @param {string} userId
     */
    unblacklistUser(userId) {
        this.ensureUser(userId);
        this._updateBlacklist.run(0, null, userId);
    }
    /**
     * Checks if a user is blacklisted
     * @param {string} userId
     * @returns {Object|boolean}
     */
    isBlacklisted(userId) {
        const user = this.getUser(userId);
        if (!user || !user.blacklisted)
            return false;
        return { blacklisted: true, reason: user.blacklist_reason || 'No reason provided' };
    }
    /**
     * Adds a track to user history
     * @param {string} userId
     * @param {Object} trackInfo
     */
    addTrackToHistory(userId, trackInfo) {
        if (!trackInfo || !trackInfo.identifier)
            return;
        this.ensureUser(userId);
        let history = [];
        const user = this.getUser(userId);
        if (user && user.history) {
            try {
                history = JSON.parse(user.history);
            }
            catch {
                history = [];
            }
        }
        const historyEntry = {
            identifier: trackInfo.identifier,
            title: trackInfo.title || 'Unknown Track',
            author: trackInfo.author || 'Unknown',
            uri: trackInfo.uri || null,
            duration: trackInfo.duration || null,
            sourceName: trackInfo.sourceName || null,
            artworkUrl: trackInfo.artworkUrl || null,
            addedAt: Date.now()
        };
        // @ts-ignore
        history = history.filter(t => t && t.identifier !== historyEntry.identifier);
        history.unshift(historyEntry);
        history = history.slice(0, HISTORY_LIMIT);
        this._updateHistory.run(JSON.stringify(history), userId);
    }
    /**
     * Retrieves user history
     * @param {string} userId
     * @returns {Array<Object>}
     */
    getHistory(userId) {
        const user = this.getUser(userId);
        if (!user || !user.history)
            return [];
        try {
            return JSON.parse(user.history);
        }
        catch {
            return [];
        }
    }
    /**
     * Cleans up invalid entries in user history
     * @param {string} userId
     */
    cleanupHistory(userId) {
        const user = this.getUser(userId);
        if (!user || !user.history)
            return;
        try {
            let history = JSON.parse(user.history);
            history = history
                // @ts-ignore
                .filter(track => track && track.identifier)
                // @ts-ignore
                .map(track => ({
                identifier: track.identifier,
                title: track.title || 'Unknown Track',
                author: track.author || 'Unknown',
                uri: track.uri || null,
                duration: track.duration || null,
                sourceName: track.sourceName || null,
                artworkUrl: track.artworkUrl || null,
                addedAt: track.addedAt || Date.now()
            }));
            this._updateHistory.run(JSON.stringify(history), userId);
        }
        catch (e) {
            logger.error('UserDB', `Failed to cleanup history for user ${userId}`, e);
        }
    }
    /**
     * Sets entire user history
     * @param {string} userId
     * @param {Array<Object>} history
     */
    setUserHistory(userId, history) {
        this.ensureUser(userId);
        const limitedHistory = history.slice(0, HISTORY_LIMIT);
        this._updateHistory.run(JSON.stringify(limitedHistory), userId);
    }
    /**
     * Links a Spotify profile to the user
     * @param {string} userId
     * @param {string} profileUrl
     * @param {string|null} displayName
     */
    linkSpotifyProfile(userId, profileUrl, displayName = null) {
        this.ensureUser(userId);
        this._updateSpotify.run(profileUrl, displayName, userId);
    }
    /**
     * Retrieves the linked Spotify profile
     * @param {string} userId
     * @returns {Object|null}
     */
    getSpotifyProfile(userId) {
        const user = this.getUser(userId);
        if (!user || !user.spotify_profile_url)
            return null;
        return {
            profileUrl: user.spotify_profile_url,
            displayName: user.spotify_display_name,
            linkedAt: user.spotify_linked_at
        };
    }
    /**
     * Unlinks the Spotify profile
     * @param {string} userId
     */
    unlinkSpotifyProfile(userId) {
        this.ensureUser(userId);
        this._unlinkSpotify.run(userId);
    }
    getLocale(userId) {
        const user = this.getUser(userId);
        return user?.locale || null;
    }
    setLocale(userId, locale) {
        this.ensureUser(userId);
        // @ts-ignore
        this._updateLocale.run(locale, userId);
    }
}
