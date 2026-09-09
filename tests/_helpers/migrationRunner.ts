import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'src', 'database', 'migrations');

const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
  .sort();

/**
 * Mirrors the production migration runner but evaluates the migration body
 * against a fresh SQLite handle. We read the file source and extract every
 * `db.exec(`SQL`) call so the test DB ends up with the same schema as prod.
 */
export function runFileMigrations(db: Database.Database) {
  for (const file of MIGRATION_FILES) {
    const path = join(MIGRATIONS_DIR, file);
    const src = readFileSync(path, 'utf8');
    const calls = [...src.matchAll(/db\.exec\(`([\s\S]*?)`\)/g)];
    for (const m of calls) {
      db.exec(m[1]);
    }
  }
}
