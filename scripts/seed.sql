-- Seed data for development

-- Store
INSERT OR IGNORE INTO stores (id, name, allowed_sending_start_time, allowed_sending_end_time, messaging_frequency_limit_hours, created_at, updated_at) 
VALUES ('store_demo001', 'デモ店舗', '12:00', '22:30', 24, unixepoch(), unixepoch());

-- Users (password: "password123" - bcrypt hash)
-- Manager
INSERT OR IGNORE INTO users (id, store_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES ('user_manager001', 'store_demo001', 'manager@example.com', '$2b$10$5F7Z5x3R/Htxqo0fjYDBAeVrZ/SEXrGApepnsYXCtpG2ofZpXzmr6', 'マネージャー太郎', 'manager', 1, unixepoch(), unixepoch());

-- Cast 1
INSERT OR IGNORE INTO users (id, store_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES ('user_cast001', 'store_demo001', 'cast1@example.com', '$2b$10$5F7Z5x3R/Htxqo0fjYDBAeVrZ/SEXrGApepnsYXCtpG2ofZpXzmr6', 'さくら', 'cast', 1, unixepoch(), unixepoch());

-- Cast 2
INSERT OR IGNORE INTO users (id, store_id, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES ('user_cast002', 'store_demo001', 'cast2@example.com', '$2b$10$5F7Z5x3R/Htxqo0fjYDBAeVrZ/SEXrGApepnsYXCtpG2ofZpXzmr6', 'あやか', 'cast', 1, unixepoch(), unixepoch());

-- LINE Channel (要：実際のトークンに置き換え)
INSERT OR IGNORE INTO line_channels (id, store_id, channel_access_token, channel_secret, bot_user_id, is_active, created_at, updated_at)
VALUES ('channel_001', 'store_demo001', 'YOUR_CHANNEL_ACCESS_TOKEN', 'YOUR_CHANNEL_SECRET', 'YOUR_BOT_USER_ID', 1, unixepoch(), unixepoch());

-- Templates
-- 店舗テンプレート
INSERT OR IGNORE INTO templates (id, store_id, scope, owner_cast_id, type, title, body, is_active, created_at, updated_at)
VALUES (
  'tmpl_store001', 
  'store_demo001', 
  'store', 
  NULL, 
  'follow_up_7', 
  '7日フォローアップ',
  '{callName}様\n\nこんにちは！\nいつもありがとうございます✨\n\nまたお店でお会いできるのを楽しみにしています😊\n\n{castName}',
  1,
  unixepoch(),
  unixepoch()
);

INSERT OR IGNORE INTO templates (id, store_id, scope, owner_cast_id, type, title, body, is_active, created_at, updated_at)
VALUES (
  'tmpl_store002', 
  'store_demo001', 
  'store', 
  NULL, 
  'follow_up_14', 
  '14日フォローアップ',
  '{callName}様\n\nお久しぶりです！\n最近いかがお過ごしですか？😊\n\n今度お時間ある時、ぜひ遊びに来てくださいね💕\n\n{castName}',
  1,
  unixepoch(),
  unixepoch()
);

INSERT OR IGNORE INTO templates (id, store_id, scope, owner_cast_id, type, title, body, is_active, created_at, updated_at)
VALUES (
  'tmpl_store003', 
  'store_demo001', 
  'store', 
  NULL, 
  'reactivate_30', 
  '休眠掘り起こし',
  '{callName}様\n\nご無沙汰しております！\nお元気でしょうか？😊\n\n久しぶりにお会いしたいです✨\nよかったらまた遊びに来てください💕\n\n{castName}',
  1,
  unixepoch(),
  unixepoch()
);

-- キャストテンプレート
INSERT OR IGNORE INTO templates (id, store_id, scope, owner_cast_id, type, title, body, is_active, created_at, updated_at)
VALUES (
  'tmpl_cast001', 
  'store_demo001', 
  'cast', 
  'user_cast001', 
  'custom', 
  'さくらのカスタム挨拶',
  '{callName}様\n\nさくらです🌸\nいつもありがとうございます！\n\nまた一緒に楽しい時間を過ごしましょうね💕\n\nさくら',
  1,
  unixepoch(),
  unixepoch()
);

-- Todo Generation Rules
INSERT OR IGNORE INTO todo_generation_rules (id, store_id, rule_type, is_enabled, days_after_last_visit, cron_schedule, created_at, updated_at)
VALUES ('rule_001', 'store_demo001', 'follow_up_7', 1, 7, '0 12 * * *', unixepoch(), unixepoch());

INSERT OR IGNORE INTO todo_generation_rules (id, store_id, rule_type, is_enabled, days_after_last_visit, cron_schedule, created_at, updated_at)
VALUES ('rule_002', 'store_demo001', 'follow_up_14', 1, 14, '0 12 * * *', unixepoch(), unixepoch());

INSERT OR IGNORE INTO todo_generation_rules (id, store_id, rule_type, is_enabled, days_after_last_visit, cron_schedule, created_at, updated_at)
VALUES ('rule_003', 'store_demo001', 'reactivate_30', 1, 30, '0 12 * * *', unixepoch(), unixepoch());
