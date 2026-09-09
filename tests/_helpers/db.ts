import Database from 'better-sqlite3';
import { runFileMigrations } from './migrationRunner';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TestDb {
  db: Database.Database;
  path: string;
  cleanup: () => void;
}

/**
 * Creates a fresh in-memory-style SQLite database (uses a tmp file because
 * better-sqlite3 needs a path for many operations) and runs the production
 * migrations against it. The returned object holds the db handle and a
 * cleanup() to call in afterEach/afterAll.
 */
export function makeTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), 'yuna-test-'));
  const path = join(dir, 'test.db');
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runFileMigrations(db);
  return {
    db,
    path,
    cleanup: () => {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}
