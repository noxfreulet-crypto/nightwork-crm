import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ===========================
// Stores（店舗）
// ===========================
export const stores = sqliteTable('stores', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  allowedSendingStartTime: text('allowed_sending_start_time').default('12:00').notNull(), // HH:mm
  allowedSendingEndTime: text('allowed_sending_end_time').default('22:30').notNull(), // HH:mm
  messagingFrequencyLimitHours: integer('messaging_frequency_limit_hours').default(24).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

// ===========================
// Users（ユーザー: manager/cast）
// ===========================
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role', { enum: ['manager', 'cast'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  storeEmailIdx: index('users_store_email_idx').on(table.storeId, table.email),
  storeIdIdx: index('users_store_id_idx').on(table.storeId),
}));

// ===========================
// Sessions（Lucia認証用）
// ===========================
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
}));

// ===========================
// LINE Channels（店舗公式LINEアカウント）
// ===========================
export const lineChannels = sqliteTable('line_channels', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  channelAccessToken: text('channel_access_token').notNull(), // 暗号化して保存すべき
  channelSecret: text('channel_secret').notNull(), // 暗号化して保存すべき
  botUserId: text('bot_user_id').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  storeIdIdx: index('line_channels_store_id_idx').on(table.storeId),
  botUserIdIdx: index('line_channels_bot_user_id_idx').on(table.botUserId),
}));

// ===========================
// Customers（顧客）
// ===========================
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  lineUserId: text('line_user_id').notNull(),
  lineDisplayName: text('line_display_name'),
  callName: text('call_name'), // キャストが呼ぶ名前
  assignedCastId: text('assigned_cast_id').references(() => users.id, { onDelete: 'set null' }),
  messagingStatus: text('messaging_status', { enum: ['active', 'blocked', 'unfollowed'] }).default('active').notNull(),
  tags: text('tags'), // JSON array string
  notes: text('notes'),
  lastVisitAt: integer('last_visit_at', { mode: 'timestamp' }),
  lastMessageSentAt: integer('last_message_sent_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  storeLineUserIdx: index('customers_store_line_user_idx').on(table.storeId, table.lineUserId),
  assignedCastIdx: index('customers_assigned_cast_idx').on(table.assignedCastId),
  storeIdIdx: index('customers_store_id_idx').on(table.storeId),
}));

// ===========================
// Visits（来店履歴）
// ===========================
export const visits = sqliteTable('visits', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
  approxSpend: integer('approx_spend'),
  nominationType: text('nomination_type', { enum: ['main', 'in_house', 'help', 'none'] }),
  memo: text('memo'),
  registeredByCastId: text('registered_by_cast_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  customerIdIdx: index('visits_customer_id_idx').on(table.customerId),
  storeIdIdx: index('visits_store_id_idx').on(table.storeId),
  occurredAtIdx: index('visits_occurred_at_idx').on(table.occurredAt),
}));

// ===========================
// Todos（送るべき顧客リスト）
// ===========================
export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  castId: text('cast_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['follow_up_7', 'follow_up_14', 'reactivate_30', 'birthday'] }).notNull(),
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'skipped'] }).default('pending').notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  castIdStatusIdx: index('todos_cast_id_status_idx').on(table.castId, table.status),
  customerIdTypeIdx: index('todos_customer_id_type_idx').on(table.customerId, table.type),
  storeIdIdx: index('todos_store_id_idx').on(table.storeId),
  dueDateIdx: index('todos_due_date_idx').on(table.dueDate),
}));

// ===========================
// Templates（メッセージテンプレート）
// ===========================
export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  scope: text('scope', { enum: ['store', 'cast'] }).notNull(),
  ownerCastId: text('owner_cast_id').references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['follow_up_7', 'follow_up_14', 'reactivate_30', 'birthday', 'custom'] }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(), // 変数: {callName} {castName} {lastVisit} {storeName}
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  storeIdScopeIdx: index('templates_store_id_scope_idx').on(table.storeId, table.scope),
  ownerCastIdIdx: index('templates_owner_cast_id_idx').on(table.ownerCastId),
}));

// ===========================
// Message Logs（送信ログ）
// ===========================
export const messageLogs = sqliteTable('message_logs', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  castId: text('cast_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  templateId: text('template_id').references(() => templates.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  status: text('status', { enum: ['success', 'failed', 'blocked'] }).notNull(),
  apiResponse: text('api_response'), // JSON string
  sentAt: integer('sent_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  customerIdIdx: index('message_logs_customer_id_idx').on(table.customerId),
  castIdIdx: index('message_logs_cast_id_idx').on(table.castId),
  storeIdIdx: index('message_logs_store_id_idx').on(table.storeId),
  sentAtIdx: index('message_logs_sent_at_idx').on(table.sentAt),
}));

// ===========================
// Inbound Messages（受信メッセージ）
// ===========================
export const inboundMessages = sqliteTable('inbound_messages', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  lineUserId: text('line_user_id').notNull(),
  messageType: text('message_type').notNull(), // text, image, video, etc.
  body: text('body'),
  receivedAt: integer('received_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  customerIdIdx: index('inbound_messages_customer_id_idx').on(table.customerId),
  storeIdIdx: index('inbound_messages_store_id_idx').on(table.storeId),
  receivedAtIdx: index('inbound_messages_received_at_idx').on(table.receivedAt),
}));

// ===========================
// Registration Codes（登録コード）
// ===========================
export const registrationCodes = sqliteTable('registration_codes', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  castId: text('cast_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  usedByCustomerId: text('used_by_customer_id').references(() => customers.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  storeCodeIdx: index('registration_codes_store_code_idx').on(table.storeId, table.code),
  castIdIdx: index('registration_codes_cast_id_idx').on(table.castId),
}));

// ===========================
// Audit Logs（監査ログ）
// ===========================
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  entity: text('entity').notNull(), // 'customer', 'visit', 'message', etc.
  entityId: text('entity_id'),
  action: text('action').notNull(), // 'create', 'update', 'delete', 'send'
  diff: text('diff'), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  storeIdIdx: index('audit_logs_store_id_idx').on(table.storeId),
  actorUserIdIdx: index('audit_logs_actor_user_id_idx').on(table.actorUserId),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));

// ===========================
// Todo Generation Rules（ToDo生成ルール）
// ===========================
export const todoGenerationRules = sqliteTable('todo_generation_rules', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  ruleType: text('rule_type', { enum: ['follow_up_7', 'follow_up_14', 'reactivate_30', 'birthday'] }).notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true).notNull(),
  daysAfterLastVisit: integer('days_after_last_visit'), // 7, 14, 30
  cronSchedule: text('cron_schedule').default('0 12 * * *').notNull(), // 毎日12:00
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  storeIdIdx: index('todo_generation_rules_store_id_idx').on(table.storeId),
}));

// Type exports for TypeScript
export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type LineChannel = typeof lineChannels.$inferSelect;
export type NewLineChannel = typeof lineChannels.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

export type MessageLog = typeof messageLogs.$inferSelect;
export type NewMessageLog = typeof messageLogs.$inferInsert;

export type InboundMessage = typeof inboundMessages.$inferSelect;
export type NewInboundMessage = typeof inboundMessages.$inferInsert;

export type RegistrationCode = typeof registrationCodes.$inferSelect;
export type NewRegistrationCode = typeof registrationCodes.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type TodoGenerationRule = typeof todoGenerationRules.$inferSelect;
export type NewTodoGenerationRule = typeof todoGenerationRules.$inferInsert;
