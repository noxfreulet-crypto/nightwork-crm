import { Hono } from 'hono';
import { eq, and, isNull, gt } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { registrationCodes } from '../db/schema';
import { generateId, generateRegistrationCode, endOfDay } from '../lib/utils';
import type { Variables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

export function createRegistrationCodesRoutes(db: DbClient) {
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', requireAuth());

  /**
   * 登録コード生成
   */
  app.post('/', async (c) => {
    try {
      const user = c.get('user')!;
      const body = await c.req.json();

      const expiresAt = body.expiresAt 
        ? new Date(body.expiresAt) 
        : endOfDay(); // デフォルト: 当日23:59:59

      const code = generateRegistrationCode(6);
      const codeId = generateId('code');

      await db.insert(registrationCodes).values({
        id: codeId,
        storeId: user.storeId,
        castId: user.id,
        code,
        expiresAt,
      });

      const [created] = await db
        .select()
        .from(registrationCodes)
        .where(eq(registrationCodes.id, codeId))
        .limit(1);

      return c.json({ registrationCode: created });
    } catch (error) {
      console.error('Create registration code error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 自分の登録コード一覧取得
   */
  app.get('/', async (c) => {
    try {
      const user = c.get('user')!;

      // マネージャーは全コード、キャストは自分のコードのみ
      const conditions = [eq(registrationCodes.storeId, user.storeId)];
      if (user.role === 'cast') {
        conditions.push(eq(registrationCodes.castId, user.id));
      }

      const codes = await db
        .select()
        .from(registrationCodes)
        .where(and(...conditions))
        .orderBy(registrationCodes.createdAt);

      return c.json({ registrationCodes: codes });
    } catch (error) {
      console.error('Get registration codes error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 有効な登録コード取得
   */
  app.get('/active', async (c) => {
    try {
      const user = c.get('user')!;
      const now = new Date();

      const codes = await db
        .select()
        .from(registrationCodes)
        .where(
          and(
            eq(registrationCodes.storeId, user.storeId),
            eq(registrationCodes.castId, user.id),
            isNull(registrationCodes.usedAt),
            gt(registrationCodes.expiresAt, now)
          )
        )
        .orderBy(registrationCodes.expiresAt);

      return c.json({ registrationCodes: codes });
    } catch (error) {
      console.error('Get active codes error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
