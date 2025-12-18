import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { DbClient } from '../db/client';
import { users } from '../db/schema';
import { generateId } from '../lib/utils';
import type { Variables } from '../middleware/auth';
import { requireAuth, requireRole } from '../middleware/auth';

export function createUsersRoutes(db: DbClient) {
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', requireAuth());

  /**
   * ユーザー一覧取得（マネージャーのみ）
   */
  app.get('/', requireRole(['manager']), async (c) => {
    try {
      const user = c.get('user')!;

      const allUsers = await db
        .select({
          id: users.id,
          storeId: users.storeId,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.storeId, user.storeId))
        .orderBy(users.role, users.displayName);

      return c.json({ users: allUsers });
    } catch (error) {
      console.error('Get users error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * キャスト一覧取得
   */
  app.get('/casts', async (c) => {
    try {
      const user = c.get('user')!;

      const casts = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          isActive: users.isActive,
        })
        .from(users)
        .where(
          and(
            eq(users.storeId, user.storeId),
            eq(users.role, 'cast')
          )
        )
        .orderBy(users.displayName);

      return c.json({ casts });
    } catch (error) {
      console.error('Get casts error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * ユーザー作成（マネージャーのみ）
   */
  app.post('/', requireRole(['manager']), async (c) => {
    try {
      const currentUser = c.get('user')!;
      const body = await c.req.json();

      const { email, password, displayName, role } = body;

      if (!email || !password || !displayName || !role) {
        return c.json({ error: 'All fields are required' }, 400);
      }

      if (!['manager', 'cast'].includes(role)) {
        return c.json({ error: 'Invalid role' }, 400);
      }

      // メールアドレス重複チェック
      const [existing] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.storeId, currentUser.storeId),
            eq(users.email, email)
          )
        )
        .limit(1);

      if (existing) {
        return c.json({ error: 'Email already exists' }, 400);
      }

      // パスワードハッシュ化
      const passwordHash = await bcrypt.hash(password, 10);

      const userId = generateId('user');
      await db.insert(users).values({
        id: userId,
        storeId: currentUser.storeId,
        email,
        passwordHash,
        displayName,
        role,
      });

      const [created] = await db
        .select({
          id: users.id,
          storeId: users.storeId,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return c.json({ user: created });
    } catch (error) {
      console.error('Create user error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * ユーザー更新（マネージャーのみ）
   */
  app.patch('/:id', requireRole(['manager']), async (c) => {
    try {
      const currentUser = c.get('user')!;
      const userId = c.req.param('id');
      const body = await c.req.json();

      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, userId),
            eq(users.storeId, currentUser.storeId)
          )
        )
        .limit(1);

      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.displayName !== undefined) {
        updateData.displayName = body.displayName;
      }
      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }
      if (body.password) {
        updateData.passwordHash = await bcrypt.hash(body.password, 10);
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      const [updated] = await db
        .select({
          id: users.id,
          storeId: users.storeId,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return c.json({ user: updated });
    } catch (error) {
      console.error('Update user error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
