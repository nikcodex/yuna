export function up(db: any) {

  db.exec(`
    CREATE TABLE IF NOT EXISTS command_cooldowns (
      key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      command_name TEXT NOT NULL,
      last_used INTEGER NOT NULL,
      violation_count INTEGER NOT NULL DEFAULT 0,
      violation_timestamps TEXT NOT NULL DEFAULT '[]',
      expires_at INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cooldowns_user ON command_cooldowns(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cooldowns_expires ON command_cooldowns(expires_at)`);
}

// Made by Nikhil Under CodeX Devs
