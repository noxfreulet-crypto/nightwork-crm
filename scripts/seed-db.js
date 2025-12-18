import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const DB_PATH = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite';

console.log('Seeding local database...');

try {
  const db = new Database(DB_PATH);

  // Store
  const storeId = 'store_demo001';
  db.prepare(`
    INSERT OR IGNORE INTO stores (id, name, allowed_sending_start_time, allowed_sending_end_time, messaging_frequency_limit_hours, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run(storeId, 'デモ店舗', '12:00', '22:30', 24);

  // Password hash for "password123"
  const passwordHash = bcrypt.hashSync('password123', 10);

  // Manager
  db.prepare(`
    INSERT OR IGNORE INTO users (id, store_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run('user_manager001', storeId, 'manager@example.com', passwordHash, 'マネージャー太郎', 'manager', 1);

  // Cast 1
  db.prepare(`
    INSERT OR IGNORE INTO users (id, store_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run('user_cast001', storeId, 'cast1@example.com', passwordHash, 'さくら', 'cast', 1);

  // Cast 2
  db.prepare(`
    INSERT OR IGNORE INTO users (id, store_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run('user_cast002', storeId, 'cast2@example.com', passwordHash, 'あやか', 'cast', 1);

  // LINE Channel (要：実際のトークンに置き換え)
  db.prepare(`
    INSERT OR IGNORE INTO line_channels (id, store_id, channel_access_token, channel_secret, bot_user_id, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run('channel_001', storeId, 'YOUR_CHANNEL_ACCESS_TOKEN', 'YOUR_CHANNEL_SECRET', 'YOUR_BOT_USER_ID', 1);

  // Templates
  db.prepare(`
    INSERT OR IGNORE INTO templates (id, store_id, scope, owner_cast_id, type, title, body, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run(
    'tmpl_store001',
    storeId,
    'store',
    null,
    'follow_up_7',
    '7日フォローアップ',
    '{callName}様\n\nこんにちは！\nいつもありがとうございます✨\n\nまたお店でお会いできるのを楽しみにしています😊\n\n{castName}',
    1
  );

  db.prepare(`
    INSERT OR IGNORE INTO templates (id, store_id, scope, owner_cast_id, type, title, body, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run(
    'tmpl_store002',
    storeId,
    'store',
    null,
    'follow_up_14',
    '14日フォローアップ',
    '{callName}様\n\nお久しぶりです！\n最近いかがお過ごしですか？😊\n\n今度お時間ある時、ぜひ遊びに来てくださいね💕\n\n{castName}',
    1
  );

  db.prepare(`
    INSERT OR IGNORE INTO templates (id, store_id, scope, owner_cast_id, type, title, body, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run(
    'tmpl_store003',
    storeId,
    'store',
    null,
    'reactivate_30',
    '休眠掘り起こし',
    '{callName}様\n\nご無沙汰しております！\nお元気でしょうか？😊\n\n久しぶりにお会いしたいです✨\nよかったらまた遊びに来てください💕\n\n{castName}',
    1
  );

  // Todo Generation Rules
  db.prepare(`
    INSERT OR IGNORE INTO todo_generation_rules (id, store_id, rule_type, is_enabled, days_after_last_visit, cron_schedule, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run('rule_001', storeId, 'follow_up_7', 1, 7, '0 12 * * *');

  db.prepare(`
    INSERT OR IGNORE INTO todo_generation_rules (id, store_id, rule_type, is_enabled, days_after_last_visit, cron_schedule, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run('rule_002', storeId, 'follow_up_14', 1, 14, '0 12 * * *');

  db.prepare(`
    INSERT OR IGNORE INTO todo_generation_rules (id, store_id, rule_type, is_enabled, days_after_last_visit, cron_schedule, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run('rule_003', storeId, 'reactivate_30', 1, 30, '0 12 * * *');

  console.log('✅ Seed data inserted successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('Manager: manager@example.com / password123');
  console.log('Cast 1:  cast1@example.com / password123');
  console.log('Cast 2:  cast2@example.com / password123');

  db.close();
} catch (error) {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
}
