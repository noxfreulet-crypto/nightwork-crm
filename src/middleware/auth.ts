import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { DbClient } from '../db/client';
import { 
  SESSION_COOKIE_NAME, 
  validateSession, 
  type SessionUser, 
  type Session 
} from '../lib/auth';

export type Variables = {
  user: SessionUser | null;
  session: Session | null;
  db: DbClient;
};

/**
 * 認証ミドルウェア
 */
export function authMiddleware(db: DbClient) {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);

    if (!sessionId) {
      c.set('user', null);
      c.set('session', null);
      return next();
    }

    const { session, user } = await validateSession(db, sessionId);

    c.set('user', user);
    c.set('session', session);

    return next();
  };
}

/**
 * 認証必須ミドルウェア
 */
export function requireAuth() {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  };
}

/**
 * ロール確認ミドルウェア
 */
export function requireRole(allowedRoles: ('manager' | 'cast')[]) {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return next();
  };
}
