import { Hono } from 'hono';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { customers, visits, inboundMessages, messageLogs } from '../db/schema';
import { generateId } from '../lib/utils';
import type { Variables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

export function createCustomersRoutes(db: DbClient) {
  const app = new Hono<{ Variables: Variables }>();

  // 全ルートで認証必須
  app.use('*', requireAuth());

  /**
   * 顧客一覧取得
   */
  app.get('/', async (c) => {
    try {
      const user = c.get('user')!;
      const query = c.req.query();

      const search = query.search || '';
      const castId = query.castId || '';
      const limit = parseInt(query.limit || '50');
      const offset = parseInt(query.offset || '0');

      let conditions = [eq(customers.storeId, user.storeId)];

      // キャストは自分担当のみ
      if (user.role === 'cast') {
        conditions.push(eq(customers.assignedCastId, user.id));
      } else if (castId) {
        conditions.push(eq(customers.assignedCastId, castId));
      }

      // 検索
      if (search) {
        conditions.push(
          sql`(${customers.callName} LIKE ${`%${search}%`} OR ${customers.lineDisplayName} LIKE ${`%${search}%`})`
        );
      }

      const results = await db
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.updatedAt))
        .limit(limit)
        .offset(offset);

      return c.json({ customers: results });
    } catch (error) {
      console.error('Get customers error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 顧客詳細取得
   */
  app.get('/:id', async (c) => {
    try {
      const user = c.get('user')!;
      const customerId = c.req.param('id');

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

      // キャストは自分担当のみ閲覧可能
      if (user.role === 'cast' && customer.assignedCastId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      // 来店履歴取得
      const visitHistory = await db
        .select()
        .from(visits)
        .where(eq(visits.customerId, customerId))
        .orderBy(desc(visits.occurredAt))
        .limit(20);

      // 受信メッセージ取得
      const inboundHistory = await db
        .select()
        .from(inboundMessages)
        .where(eq(inboundMessages.customerId, customerId))
        .orderBy(desc(inboundMessages.receivedAt))
        .limit(20);

      // 送信履歴取得
      const sentHistory = await db
        .select()
        .from(messageLogs)
        .where(eq(messageLogs.customerId, customerId))
        .orderBy(desc(messageLogs.sentAt))
        .limit(20);

      return c.json({
        customer,
        visitHistory,
        inboundHistory,
        sentHistory,
      });
    } catch (error) {
      console.error('Get customer error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 顧客情報更新
   */
  app.patch('/:id', async (c) => {
    try {
      const user = c.get('user')!;
      const customerId = c.req.param('id');
      const body = await c.req.json();

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

      // キャストは自分担当のみ編集可能
      if (user.role === 'cast' && customer.assignedCastId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.callName !== undefined) {
        updateData.callName = body.callName;
      }
      if (body.notes !== undefined) {
        updateData.notes = body.notes;
      }
      if (body.tags !== undefined) {
        updateData.tags = JSON.stringify(body.tags);
      }

      // マネージャーのみ担当変更可能
      if (body.assignedCastId !== undefined && user.role === 'manager') {
        updateData.assignedCastId = body.assignedCastId;
      }

      await db
        .update(customers)
        .set(updateData)
        .where(eq(customers.id, customerId));

      const [updated] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      return c.json({ customer: updated });
    } catch (error) {
      console.error('Update customer error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 来店登録
   */
  app.post('/:id/visits', async (c) => {
    try {
      const user = c.get('user')!;
      const customerId = c.req.param('id');
      const body = await c.req.json();

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

      // キャストは自分担当のみ登録可能
      if (user.role === 'cast' && customer.assignedCastId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();

      const visitId = generateId('visit');
      await db.insert(visits).values({
        id: visitId,
        storeId: user.storeId,
        customerId,
        occurredAt,
        approxSpend: body.approxSpend || null,
        nominationType: body.nominationType || null,
        memo: body.memo || null,
        registeredByCastId: user.id,
      });

      // 顧客の最終来店日を更新
      await db
        .update(customers)
        .set({
          lastVisitAt: occurredAt,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));

      const [visit] = await db
        .select()
        .from(visits)
        .where(eq(visits.id, visitId))
        .limit(1);

      return c.json({ visit });
    } catch (error) {
      console.error('Create visit error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 来店履歴取得
   */
  app.get('/:id/visits', async (c) => {
    try {
      const user = c.get('user')!;
      const customerId = c.req.param('id');

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

      if (user.role === 'cast' && customer.assignedCastId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const visitHistory = await db
        .select()
        .from(visits)
        .where(eq(visits.customerId, customerId))
        .orderBy(desc(visits.occurredAt))
        .limit(50);

      return c.json({ visits: visitHistory });
    } catch (error) {
      console.error('Get visits error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
