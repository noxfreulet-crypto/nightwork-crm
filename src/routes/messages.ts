import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { 
  customers, 
  messageLogs, 
  templates, 
  lineChannels,
  stores,
  users
} from '../db/schema';
import { 
  generateId, 
  replaceTemplateVariables, 
  isWithinAllowedSendingTime,
  canSendMessage,
  formatDate
} from '../lib/utils';
import { LineMessagingClient } from '../lib/line';
import type { Variables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

export function createMessagesRoutes(db: DbClient) {
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', requireAuth());

  /**
   * メッセージ送信
   */
  app.post('/send', async (c) => {
    try {
      const user = c.get('user')!;
      const body = await c.req.json();

      const { customerId, message, templateId } = body;

      if (!customerId || !message) {
        return c.json({ error: 'Customer ID and message are required' }, 400);
      }

      // 顧客取得
      const [customer] = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, customerId),
            eq(customers.storeId, user.storeId)
          )
        )
        .limit(1);

      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // キャストは自分担当のみ
      if (user.role === 'cast' && customer.assignedCastId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      // ブロックチェック
      if (customer.messagingStatus !== 'active') {
        return c.json({ 
          error: 'Cannot send message to inactive customer',
          status: customer.messagingStatus 
        }, 400);
      }

      // 店舗設定取得
      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, user.storeId))
        .limit(1);

      if (!store) {
        return c.json({ error: 'Store not found' }, 404);
      }

      // 送信時間帯チェック
      if (!isWithinAllowedSendingTime(
        store.allowedSendingStartTime,
        store.allowedSendingEndTime
      )) {
        return c.json({ 
          error: 'Message sending is not allowed at this time',
          allowedTime: `${store.allowedSendingStartTime} - ${store.allowedSendingEndTime}`
        }, 400);
      }

      // 送信頻度チェック
      if (!canSendMessage(
        customer.lastMessageSentAt ? new Date(customer.lastMessageSentAt) : null,
        store.messagingFrequencyLimitHours
      )) {
        return c.json({ 
          error: 'Message frequency limit exceeded',
          limitHours: store.messagingFrequencyLimitHours
        }, 429);
      }

      // LINEチャンネル取得
      const [channel] = await db
        .select()
        .from(lineChannels)
        .where(
          and(
            eq(lineChannels.storeId, user.storeId),
            eq(lineChannels.isActive, true)
          )
        )
        .limit(1);

      if (!channel) {
        return c.json({ error: 'LINE channel not configured' }, 404);
      }

      // メッセージ送信
      const lineClient = new LineMessagingClient(channel.channelAccessToken);
      const result = await lineClient.pushMessage(customer.lineUserId, message);

      // ログ保存
      const logId = generateId('log');
      await db.insert(messageLogs).values({
        id: logId,
        storeId: user.storeId,
        customerId,
        castId: user.id,
        templateId: templateId || null,
        body: message,
        status: result.success ? 'success' : 'failed',
        apiResponse: JSON.stringify(result),
        sentAt: new Date(),
      });

      // 顧客の最終送信日時を更新
      if (result.success) {
        await db
          .update(customers)
          .set({
            lastMessageSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, customerId));
      }

      return c.json({ 
        success: result.success,
        messageLogId: logId,
        error: result.error
      });
    } catch (error) {
      console.error('Send message error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * テンプレートから下書き生成
   */
  app.post('/draft', async (c) => {
    try {
      const user = c.get('user')!;
      const body = await c.req.json();

      const { customerId, templateId } = body;

      if (!customerId || !templateId) {
        return c.json({ error: 'Customer ID and template ID are required' }, 400);
      }

      // 顧客取得
      const [customer] = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, customerId),
            eq(customers.storeId, user.storeId)
          )
        )
        .limit(1);

      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // テンプレート取得
      const [template] = await db
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.id, templateId),
            eq(templates.storeId, user.storeId)
          )
        )
        .limit(1);

      if (!template) {
        return c.json({ error: 'Template not found' }, 404);
      }

      // キャストテンプレートの場合は所有者チェック
      if (template.scope === 'cast' && template.ownerCastId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      // 店舗情報取得
      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, user.storeId))
        .limit(1);

      // 変数置換
      const draft = replaceTemplateVariables(template.body, {
        callName: customer.callName || customer.lineDisplayName || 'お客様',
        castName: user.displayName,
        lastVisit: customer.lastVisitAt ? formatDate(new Date(customer.lastVisitAt)) : '前回',
        storeName: store?.name || 'お店',
      });

      return c.json({ draft });
    } catch (error) {
      console.error('Create draft error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 送信履歴取得
   */
  app.get('/logs', async (c) => {
    try {
      const user = c.get('user')!;
      const query = c.req.query();

      const limit = parseInt(query.limit || '50');
      const offset = parseInt(query.offset || '0');

      const conditions = [eq(messageLogs.storeId, user.storeId)];

      // キャストは自分の送信履歴のみ
      if (user.role === 'cast') {
        conditions.push(eq(messageLogs.castId, user.id));
      }

      const logs = await db
        .select({
          log: messageLogs,
          customer: customers,
        })
        .from(messageLogs)
        .leftJoin(customers, eq(messageLogs.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(desc(messageLogs.sentAt))
        .limit(limit)
        .offset(offset);

      return c.json({ 
        logs: logs.map(l => ({
          ...l.log,
          customer: l.customer,
        }))
      });
    } catch (error) {
      console.error('Get message logs error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
