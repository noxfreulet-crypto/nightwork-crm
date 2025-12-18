import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { users } from '../db/schema';
import { 
  createSession, 
  invalidateSession,
  createSessionCookie,
  clearSessionCookie
} from '../lib/auth';
import type { Variables } from '../middleware/auth';

export function createAuthRoutes(db: DbClient) {
  const app = new Hono<{ Variables: Variables }>();

  /**
   * ログイン
   */
  app.post('/login', async (c) => {
    try {
      const { email, password } = await c.req.json();

      if (!email || !password) {
        return c.json({ error: 'Email and password are required' }, 400);
      }

      // ユーザー検索
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      // パスワード検証
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      // アクティブチェック
      if (!user.isActive) {
        return c.json({ error: 'Account is inactive' }, 403);
      }

      // セッション作成
      const session = await createSession(db, user.id);
      const sessionCookie = createSessionCookie(session.id);

      c.header('Set-Cookie', sessionCookie);

      return c.json({
        user: {
          id: user.id,
          storeId: user.storeId,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * ログアウト
   */
  app.post('/logout', async (c) => {
    try {
      const session = c.get('session');

      if (session) {
        await invalidateSession(db, session.id);
      }

      const clearCookie = clearSessionCookie();
      c.header('Set-Cookie', clearCookie);

      return c.json({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 現在のユーザー情報取得
   */
  app.get('/me', async (c) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    return c.json({ user });
  });

  return app;
}
