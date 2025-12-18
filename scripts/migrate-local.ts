import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ローカルD1データベース（.wrangler/state/v3/d1以下に作成される）
const DB_PATH = join(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite');

console.log('Migrating local D1 database...');
console.log('DB Path:', DB_PATH);

try {
  const sqlite = new Database(DB_PATH);
  const db = drizzle(sqlite);

  migrate(db, { migrationsFolder: './migrations' });

  console.log('✅ Migration completed successfully!');
  sqlite.close();
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
