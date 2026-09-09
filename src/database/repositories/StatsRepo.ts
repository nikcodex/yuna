import type BetterSqlite3Database from 'better-sqlite3';
import { logger } from '#utils/logger';

export class StatsRepo {
  public db: BetterSqlite3Database.Database;
  public _ensureStats: BetterSqlite3Database.Statement;
  public _logPlay: BetterSqlite3Database.Statement;
  public _incrementPlays: BetterSqlite3Database.Statement;
  public _addListenTime: BetterSqlite3Database.Statement;
  public _getStats: BetterSqlite3Database.Statement;
  public _updateStreak: BetterSqlite3Database.Statement;
  public _topArtists: BetterSqlite3Database.Statement;
  public _topTracks: BetterSqlite3Database.Statement;
  public _topSources: BetterSqlite3Database.Statement;
  public _recentPlays: BetterSqlite3Database.Statement;
  public _periodStats: BetterSqlite3Database.Statement;
  public _globalTopListeners: BetterSqlite3Database.Statement;

  constructor(db: BetterSqlite3Database.Database) {
    this.db = db;
    this._ensureStats = this.db.prepare('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)');
    this._logPlay = this.db.prepare(`
      INSERT INTO track_plays (user_id, track_title, track_author, track_identifier, track_uri, source_name, artwork_url, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this._incrementPlays = this.db.prepare(`
      UPDATE user_stats SET total_tracks_played = total_tracks_played + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
    `);
    this._addListenTime = this.db.prepare(`
      UPDATE user_stats SET total_listen_time_ms = total_listen_time_ms + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
    `);
    this._getStats = this.db.prepare('SELECT * FROM user_stats WHERE user_id = ?');
    this._updateStreak = this.db.prepare(`
      UPDATE user_stats SET 
        current_streak = ?,
        longest_streak = MAX(longest_streak, ?),
        last_listen_date = ?,
        first_listen_date = COALESCE(first_listen_date, ?),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);
    this._topArtists = this.db.prepare(`
      SELECT track_author as artist, COUNT(*) as play_count, MAX(artwork_url) as artwork
      FROM track_plays WHERE user_id = ? AND played_at >= ?
      GROUP BY track_author ORDER BY play_count DESC LIMIT ?
    `);
    this._topTracks = this.db.prepare(`
      SELECT track_title as title, track_author as artist, COUNT(*) as play_count, MAX(artwork_url) as artwork, MAX(track_uri) as uri
      FROM track_plays WHERE user_id = ? AND played_at >= ?
      GROUP BY track_identifier ORDER BY play_count DESC LIMIT ?
    `);
    this._topSources = this.db.prepare(`
      SELECT source_name as source, COUNT(*) as play_count
      FROM track_plays WHERE user_id = ? AND played_at >= ?
      GROUP BY source_name ORDER BY play_count DESC LIMIT ?
    `);
    this._recentPlays = this.db.prepare('SELECT * FROM track_plays WHERE user_id = ? ORDER BY played_at DESC LIMIT ?');
    this._periodStats = this.db.prepare(`
      SELECT 
        COUNT(*) as tracks_played,
        COUNT(DISTINCT track_author) as unique_artists,
        COUNT(DISTINCT track_identifier) as unique_tracks,
        COALESCE(SUM(duration_ms), 0) as total_duration_ms
      FROM track_plays WHERE user_id = ? AND played_at >= ?
    `);
    this._globalTopListeners = this.db.prepare(`
      SELECT user_id, total_tracks_played, total_listen_time_ms 
      FROM user_stats ORDER BY total_tracks_played DESC LIMIT ?
    `);
  }

  /**
   * Logs a track play for a user
   * @param {string} userId
   * @param {Object} trackInfo
   */
  logTrackPlay(userId: string, trackInfo: any) {
    try {
      this.db.transaction(() => {
        this._ensureStats.run(userId);
        this._logPlay.run(
          userId,
          trackInfo.title || 'Unknown',
          trackInfo.author || 'Unknown',
          trackInfo.identifier || null,
          trackInfo.uri || null,
          trackInfo.sourceName || null,
          trackInfo.artworkUrl || null,
          trackInfo.duration || trackInfo.length || 0
        );
        this._incrementPlays.run(userId);
        this._updateStreakFn(userId);
      })();
    } catch (err: any) {
      logger.error('StatsRepo', `Error logging track play: ${err.message}`, err);
    }
  }

  /**
   * Adds listening time for a user
   * @param {string} userId
   * @param {number} timeMs
   */
  addListenTime(userId: any, timeMs: any) {
    try {
      this._ensureStats.run(userId);
      this._addListenTime.run(timeMs, userId);
    } catch (err: any) {
      logger.error('StatsRepo', `Error adding listen time: ${err.message}`, err);
    }
  }

  _updateStreakFn(userId: string) {
    const now = new Date();
    const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    const stats = this._getStats.get(userId);
    if (!stats) return;

    const lastDate = stats.last_listen_date;
    let newStreak = stats.current_streak || 0;

    if (lastDate === today) return;

    if (lastDate) {
      const lastDay = new Date(lastDate + 'T00:00:00Z');
      const todayDay = new Date(today + 'T00:00:00Z');
      const diffDays = Math.floor((todayDay.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    this._updateStreak.run(newStreak, newStreak, today, today, userId);
  }

  /**
   * Retrieves user aggregate stats
   * @param {string} userId
   * @returns {Object}
   */
  getUserStats(userId: string) {
    this._ensureStats.run(userId);
    return this._getStats.get(userId);
  }

  /**
   * Retrieves top artists for a user
   * @param {string} userId
   * @param {string} since
   * @param {number} limit
   * @returns {Array<Object>}
   */
  getTopArtists(userId: any, since = '1970-01-01', limit = 5) {
    return this._topArtists.all(userId, since, limit);
  }

  /**
   * Retrieves top tracks for a user
   * @param {string} userId
   * @param {string} since
   * @param {number} limit
   * @returns {Array<Object>}
   */
  getTopTracks(userId: any, since = '1970-01-01', limit = 5) {
    return this._topTracks.all(userId, since, limit);
  }

  /**
   * Retrieves top sources for a user
   * @param {string} userId
   * @param {string} since
   * @param {number} limit
   * @returns {Array<Object>}
   */
  getTopSources(userId: any, since = '1970-01-01', limit = 5) {
    return this._topSources.all(userId, since, limit);
  }

  /**
   * Retrieves recent plays for a user
   * @param {string} userId
   * @param {number} limit
   * @returns {Array<Object>}
   */
  getRecentPlays(userId: any, limit = 10) {
    return this._recentPlays.all(userId, limit);
  }

  /**
   * Retrieves period stats for a user
   * @param {string} userId
   * @param {string} since
   * @returns {Object}
   */
  getPeriodStats(userId: any, since: any) {
    return this._periodStats.get(userId, since);
  }

  static getSinceDate(period = 'all') {
    const now = new Date();
    // SQLite CURRENT_TIMESTAMP format: 'YYYY-MM-DD HH:MM:SS' (no T/Z).
    // Comparing against ISO strings misorders the boundary day ('T' > ' ').
    const sqliteTimestamp = (d: Date) =>
      d.toISOString().slice(0, 19).replace('T', ' ');
    switch (period) {
      case 'today': return now.toISOString().split('T')[0];
      case 'week': now.setDate(now.getDate() - 7); return sqliteTimestamp(now);
      case 'month': now.setMonth(now.getMonth() - 1); return sqliteTimestamp(now);
      case 'year': now.setFullYear(now.getFullYear() - 1); return sqliteTimestamp(now);
      default: return '1970-01-01';
    }
  }

  /**
   * Retrieves a full stats report for a user
   * @param {string} userId
   * @param {string} period
   * @returns {Object}
   */
  getFullReport(userId: any, period = 'all') {
    const since = StatsRepo.getSinceDate(period);
    return {
      aggregate: this.getUserStats(userId),
      period: this.getPeriodStats(userId, since),
      topArtists: this.getTopArtists(userId, since, 5),
      topTracks: this.getTopTracks(userId, since, 5),
      topSources: this.getTopSources(userId, since, 5),
      recentPlays: this.getRecentPlays(userId, 5),
      periodLabel: period,
    };
  }

  /**
   * Retrieves global top listeners
   * @param {number} limit
   * @returns {Array<Object>}
   */
  getGlobalTopListeners(limit = 10) {
    return this._globalTopListeners.all(limit);
  }

  static formatTime(ms: any) {
    if (!ms || ms <= 0) return '0m';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}
