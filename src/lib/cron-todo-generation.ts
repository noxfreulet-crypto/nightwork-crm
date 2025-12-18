import { eq, and, isNull, lt, gte, sql } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { 
  customers, 
  todos, 
  todoGenerationRules,
  stores
} from '../db/schema';
import { generateId, daysAgo } from './utils';

/**
 * ToDo自動生成処理
 * Cloudflare Cron Triggerから呼び出される
 */
export async function generateTodosForAllStores(db: DbClient) {
  console.log('[Cron] Starting todo generation...');

  try {
    // 全店舗を取得
    const allStores = await db.select().from(stores);

    for (const store of allStores) {
      await generateTodosForStore(db, store.id);
    }

    console.log('[Cron] Todo generation completed for all stores');
  } catch (error) {
    console.error('[Cron] Todo generation error:', error);
    throw error;
  }
}

/**
 * 店舗ごとのToDo生成
 */
async function generateTodosForStore(db: DbClient, storeId: string) {
  console.log(`[Cron] Generating todos for store: ${storeId}`);

  // 店舗のルール取得
  const rules = await db
    .select()
    .from(todoGenerationRules)
    .where(
      and(
        eq(todoGenerationRules.storeId, storeId),
        eq(todoGenerationRules.isEnabled, true)
      )
    );

  for (const rule of rules) {
    await generateTodosByRule(db, storeId, rule);
  }
}

/**
 * ルールごとのToDo生成
 */
async function generateTodosByRule(
  db: DbClient,
  storeId: string,
  rule: any
) {
  console.log(`[Cron] Processing rule: ${rule.ruleType}`);

  const now = new Date();

  switch (rule.ruleType) {
    case 'follow_up_7':
      await generateFollowUpTodos(db, storeId, 7, 'follow_up_7');
      break;

    case 'follow_up_14':
      await generateFollowUpTodos(db, storeId, 14, 'follow_up_14');
      break;

    case 'reactivate_30':
      await generateFollowUpTodos(db, storeId, 30, 'reactivate_30');
      break;

    case 'birthday':
      // 誕生日機能は後で実装
      console.log('[Cron] Birthday todos not implemented yet');
      break;
  }
}

/**
 * フォローアップToDo生成
 */
async function generateFollowUpTodos(
  db: DbClient,
  storeId: string,
  daysAfterVisit: number,
  todoType: 'follow_up_7' | 'follow_up_14' | 'reactivate_30'
) {
  // N日前に来店した顧客を取得
  const targetDate = daysAgo(daysAfterVisit);
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // 対象顧客を取得（メッセージ送信可能なアクティブな顧客）
  const targetCustomers = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.storeId, storeId),
        eq(customers.messagingStatus, 'active'),
        isNull(customers.assignedCastId) === false,
        gte(customers.lastVisitAt, dayStart),
        lt(customers.lastVisitAt, dayEnd)
      )
    );

  console.log(
    `[Cron] Found ${targetCustomers.length} customers for ${todoType} (${daysAfterVisit} days)`
  );

  for (const customer of targetCustomers) {
    // 既に同じタイプの未完了ToDoがあるかチェック
    const [existingTodo] = await db
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.customerId, customer.id),
          eq(todos.type, todoType),
          sql`${todos.status} IN ('pending', 'in_progress')`
        )
      )
      .limit(1);

    if (existingTodo) {
      console.log(`[Cron] Todo already exists for customer: ${customer.id}`);
      continue;
    }

    // ToDo作成
    if (customer.assignedCastId) {
      const todoId = generateId('todo');
      
      await db.insert(todos).values({
        id: todoId,
        storeId,
        customerId: customer.id,
        castId: customer.assignedCastId,
        type: todoType,
        dueDate: new Date(),
        status: 'pending',
      });

      console.log(`[Cron] Created todo ${todoId} for customer ${customer.id}`);
    }
  }
}

/**
 * デフォルトルール初期化
 */
export async function initializeDefaultRules(db: DbClient, storeId: string) {
  const defaultRules = [
    {
      id: generateId('rule'),
      storeId,
      ruleType: 'follow_up_7' as const,
      isEnabled: true,
      daysAfterLastVisit: 7,
      cronSchedule: '0 12 * * *', // 毎日12:00
    },
    {
      id: generateId('rule'),
      storeId,
      ruleType: 'follow_up_14' as const,
      isEnabled: true,
      daysAfterLastVisit: 14,
      cronSchedule: '0 12 * * *',
    },
    {
      id: generateId('rule'),
      storeId,
      ruleType: 'reactivate_30' as const,
      isEnabled: true,
      daysAfterLastVisit: 30,
      cronSchedule: '0 12 * * *',
    },
  ];

  for (const rule of defaultRules) {
    await db.insert(todoGenerationRules).values(rule);
  }

  console.log(`[Init] Created default rules for store: ${storeId}`);
}
