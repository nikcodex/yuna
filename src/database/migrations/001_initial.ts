export function up(db: any) {

  db.exec(`
    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      locale TEXT DEFAULT NULL,
      prefixes TEXT,
      default_volume INTEGER DEFAULT 100,
      blacklisted BOOLEAN DEFAULT FALSE,
      blacklist_reason TEXT DEFAULT NULL,
      auto_disconnect BOOLEAN DEFAULT TRUE,
      stay_247 BOOLEAN DEFAULT FALSE,
      stay_247_voice_channel TEXT DEFAULT NULL,
      stay_247_text_channel TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS active_sessions (
      guild_id TEXT PRIMARY KEY,
      voice_channel_id TEXT NOT NULL,
      text_channel_id TEXT NOT NULL,
      current_track TEXT,
      queue_tracks TEXT DEFAULT '[]',
      position INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      locale TEXT DEFAULT NULL,
      no_prefix BOOLEAN DEFAULT FALSE,
      no_prefix_expiry INTEGER DEFAULT NULL,
      custom_prefixes TEXT DEFAULT '[]',
      blacklisted BOOLEAN DEFAULT FALSE,
      blacklist_reason TEXT DEFAULT NULL,
      history TEXT DEFAULT '[]',
      spotify_profile_url TEXT DEFAULT NULL,
      spotify_display_name TEXT DEFAULT NULL,
      spotify_linked_at TIMESTAMP DEFAULT NULL,
      np_style TEXT DEFAULT 'card',
      autoplay_cooldown INTEGER DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_premium (
      user_id TEXT PRIMARY KEY,
      premium_type TEXT DEFAULT 'user',
      granted_by TEXT NOT NULL,
      granted_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      expires_at INTEGER DEFAULT NULL,
      reason TEXT DEFAULT 'No reason provided',
      active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_premium (
      guild_id TEXT PRIMARY KEY,
      premium_type TEXT DEFAULT 'guild',
      granted_by TEXT NOT NULL,
      granted_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      expires_at INTEGER DEFAULT NULL,
      reason TEXT DEFAULT 'No reason provided',
      active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT NULL,
      tracks TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_duration INTEGER DEFAULT 0,
      track_count INTEGER DEFAULT 0
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_playlists_name ON playlists(name)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_economy (
      user_id TEXT PRIMARY KEY,
      coins INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS liked_tracks (
      user_id TEXT PRIMARY KEY,
      tracks TEXT DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id TEXT PRIMARY KEY,
      total_tracks_played INTEGER DEFAULT 0,
      total_listen_time_ms INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_listen_date TEXT DEFAULT NULL,
      first_listen_date TEXT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS track_plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      track_title TEXT NOT NULL,
      track_author TEXT NOT NULL,
      track_identifier TEXT,
      track_uri TEXT,
      source_name TEXT,
      artwork_url TEXT,
      duration_ms INTEGER DEFAULT 0,
      played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_track_plays_user ON track_plays(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_track_plays_date ON track_plays(user_id, played_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_track_plays_author ON track_plays(user_id, track_author)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_track_plays_title ON track_plays(user_id, track_title)`);
}

// Made by Nikhil Under CodeX Devs
