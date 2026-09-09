export class LikedRepo {
    db;
    _getLiked;
    _updateLiked;
    constructor(db) {
        this.db = db;
        this._getLiked = this.db.prepare('SELECT * FROM liked_tracks WHERE user_id = ?');
        this._updateLiked = this.db.prepare(`
      INSERT INTO liked_tracks (user_id, tracks, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET tracks = excluded.tracks, updated_at = CURRENT_TIMESTAMP
    `);
    }
    /**
     * Retrieves liked tracks for a user
     * @param {string} userId
     * @returns {Array<Object>}
     */
    getUserLiked(userId) {
        const data = this._getLiked.get(userId);
        if (!data)
            return [];
        try {
            return JSON.parse(data.tracks || '[]');
        }
        catch {
            return [];
        }
    }
    /**
     * Adds a track to a user's liked tracks
     * @param {string} userId
     * @param {Object} trackInfo
     * @returns {boolean} True if added, false if already liked
     */
    addLikedTrack(userId, trackInfo) {
        let result = false;
        this.db.transaction(() => {
            const tracks = this.getUserLiked(userId);
            // @ts-ignore
            if (tracks.find(t => t.identifier === trackInfo.identifier))
                return;
            const trackEntry = {
                identifier: trackInfo.identifier,
                title: trackInfo.title || 'Unknown Track',
                author: trackInfo.author || 'Unknown',
                uri: trackInfo.uri || null,
                duration: trackInfo.duration || null,
                sourceName: trackInfo.sourceName || null,
                artworkUrl: trackInfo.artworkUrl || null,
                addedAt: Date.now()
            };
            tracks.push(trackEntry);
            this._updateLiked.run(userId, JSON.stringify(tracks));
            result = true;
        })();
        return result;
    }
    /**
     * Removes a track from a user's liked tracks
     * @param {string} userId
     * @param {string} trackIdentifier
     * @returns {boolean} True if removed, false if not found
     */
    // @ts-ignore
    removeLikedTrack(userId, trackIdentifier) {
        let result = false;
        this.db.transaction(() => {
            let tracks = this.getUserLiked(userId);
            const originalLength = tracks.length;
            // @ts-ignore
            tracks = tracks.filter(t => t.identifier !== trackIdentifier);
            if (tracks.length === originalLength)
                return;
            this._updateLiked.run(userId, JSON.stringify(tracks));
            result = true;
        })();
        return result;
    }
}
