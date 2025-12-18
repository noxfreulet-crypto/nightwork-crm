import { nanoid } from 'nanoid';
import type { DbClient } from '../db/client';
import { sessions, users } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * シンプルなセッション管理システム
 * Cloudflare Workers環境で動作
 */

export const SESSION_COOKIE_NAME = 'session_id';
export const SESSION_EXPIRES_IN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  storeId: string;
  email: string;
  displayName: string;
  role: 'manager' | 'cast';
  isActive: boolean;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

/**
 * セッション作成
 */
export async function createSession(
  db: DbClient,
  userId: string
): Promise<Session> {
  const sessionId = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRES_IN_MS);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp
  });

  return {
    id: sessionId,
    userId,
    expiresAt,
  };
}

/**
 * セッション検証
 */
export async function validateSession(
  db: DbClient,
  sessionId: string
): Promise<{ session: Session | null; user: SessionUser | null }> {
  // セッション取得
  const [sessionData] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!sessionData) {
    return { session: null, user: null };
  }

  // 有効期限チェック
  const expiresAt = new Date(sessionData.expiresAt * 1000);
  if (expiresAt < new Date()) {
    // 期限切れのセッションを削除
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { session: null, user: null };
  }

  // ユーザー取得
  const [userData] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionData.userId))
    .limit(1);

  if (!userData || !userData.isActive) {
    return { session: null, user: null };
  }

  const session: Session = {
    id: sessionData.id,
    userId: sessionData.userId,
    expiresAt,
  };

  const user: SessionUser = {
    id: userData.id,
    storeId: userData.storeId,
    email: userData.email,
    displayName: userData.displayName,
    role: userData.role,
    isActive: userData.isActive,
  };

  return { session, user };
}

/**
 * セッション無効化
 */
export async function invalidateSession(
  db: DbClient,
  sessionId: string
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * セッションクッキーの生成
 */
export function createSessionCookie(sessionId: string): string {
  const maxAge = Math.floor(SESSION_EXPIRES_IN_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/**
 * セッションクッキーのクリア
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
