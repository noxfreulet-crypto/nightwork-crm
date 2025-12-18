import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/cloudflare-workers';
import { getCookie, setCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { eq, and, desc, isNull, gt, sql, or, like, gte, lt } from 'drizzle-orm';

import { createDb, type DbClient } from './db/client';
import { 
  stores, users, sessions, customers, visits, todos, 
  messageLogs, inboundMessages, templates, registrationCodes,
  lineChannels, todoGenerationRules
} from './db/schema';

import { 
  SESSION_COOKIE_NAME,
  createSession,
  validateSession,
  invalidateSession,
  createSessionCookie,
  clearSessionCookie,
  type SessionUser
} from './lib/auth';

import { 
  generateId, 
  generateRegistrationCode, 
  verifyLineSignature,
  replaceTemplateVariables,
  isWithinAllowedSendingTime,
  canSendMessage,
  formatDate,
  endOfDay,
  daysAgo
} from './lib/utils';

import { LineMessagingClient } from './lib/line';
import { generateTodosForAllStores } from './lib/cron-todo-generation';

type Bindings = {
  DB: D1Database;
};

type Variables = {
  user: SessionUser | null;
  db: DbClient;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ロガー
app.use('*', logger());

// CORS設定
app.use('/api/*', cors());

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }));

// DBミドルウェア
app.use('*', async (c, next) => {
  c.set('db', createDb(c.env.DB));
  return next();
});

// 認証ミドルウェア（APIルートのみ）
app.use('/api/*', async (c, next) => {
  const d1 = c.env.DB;
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  
  if (sessionId) {
    try {
      // セッション検証（生SQL）
      const session = await d1.prepare('SELECT * FROM sessions WHERE id = ? LIMIT 1')
        .bind(sessionId)
        .first();

      if (session) {
        const expiresAt = new Date((session.expires_at as number) * 1000);
        
        if (expiresAt > new Date()) {
          // ユーザー取得
          const userResult = await d1.prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
            .bind(session.user_id)
            .first();

          if (userResult && userResult.is_active) {
            c.set('user', {
              id: userResult.id as string,
              storeId: userResult.store_id as string,
              email: userResult.email as string,
              displayName: userResult.display_name as string,
              role: userResult.role as 'manager' | 'cast',
              isActive: userResult.is_active as boolean,
            });
          } else {
            c.set('user', null);
          }
        } else {
          // セッション期限切れ
          await d1.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
          c.set('user', null);
        }
      } else {
        c.set('user', null);
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      c.set('user', null);
    }
  } else {
    c.set('user', null);
  }
  
  return next();
});

// ===========================
// 認証API
// ===========================

app.post('/api/auth/login', async (c) => {
  try {
    console.log('[Login] Starting login attempt...');
    const d1 = c.env.DB;
    const body = await c.req.json();
    const { email, password } = body;
    
    console.log('[Login] Email:', email);

    if (!email || !password) {
      console.log('[Login] Missing email or password');
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // 生SQLでユーザー検索
    console.log('[Login] Querying database...');
    const result = await d1.prepare('SELECT * FROM users WHERE email = ? LIMIT 1')
      .bind(email)
      .first();

    console.log('[Login] Query result:', result ? 'Found' : 'Not found');

    if (!result) {
      console.log('[Login] User not found');
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // パスワード検証
    console.log('[Login] Verifying password...');
    const validPassword = await bcrypt.compare(password, result.password_hash as string);
    console.log('[Login] Password valid:', validPassword);
    
    if (!validPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // アクティブチェック
    if (!result.is_active) {
      console.log('[Login] Account inactive');
      return c.json({ error: 'Account is inactive' }, 403);
    }

    // セッション作成（生SQL）
    console.log('[Login] Creating session...');
    const sessionId = generateId('sess');
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

    await d1.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(sessionId, result.id, expiresAt)
      .run();

    console.log('[Login] Session created:', sessionId);

    c.header('Set-Cookie', createSessionCookie(sessionId));

    console.log('[Login] Login successful');
    return c.json({
      user: {
        id: result.id,
        storeId: result.store_id,
        email: result.email,
        displayName: result.display_name,
        role: result.role,
      },
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    console.error('[Login] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return c.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }, 500);
  }
});

app.post('/api/auth/logout', async (c) => {
  try {
    const d1 = c.env.DB;
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    
    if (sessionId) {
      await d1.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    }
    
    c.header('Set-Cookie', clearSessionCookie());
    return c.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/auth/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  return c.json({ user });
});

// ===========================
// 顧客API
// ===========================

app.get('/api/customers', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const query = c.req.query();
    const search = query.search || '';
    const limit = parseInt(query.limit || '50');
    const offset = parseInt(query.offset || '0');

    let conditions: any[] = [eq(customers.storeId, user.storeId)];

    if (user.role === 'cast') {
      conditions.push(eq(customers.assignedCastId, user.id));
    }

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

app.get('/api/customers/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const customerId = c.req.param('id');

    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.storeId, user.storeId)))
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
      .limit(20);

    const inboundHistory = await db
      .select()
      .from(inboundMessages)
      .where(eq(inboundMessages.customerId, customerId))
      .orderBy(desc(inboundMessages.receivedAt))
      .limit(20);

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

app.patch('/api/customers/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const customerId = c.req.param('id');
    const body = await c.req.json();

    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.storeId, user.storeId)))
      .limit(1);

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    if (user.role === 'cast' && customer.assignedCastId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const updateData: any = { updatedAt: new Date() };
    if (body.callName !== undefined) updateData.callName = body.callName;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
    if (body.assignedCastId !== undefined && user.role === 'manager') {
      updateData.assignedCastId = body.assignedCastId;
    }

    await db.update(customers).set(updateData).where(eq(customers.id, customerId));

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

app.post('/api/customers/:id/visits', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const customerId = c.req.param('id');
    const body = await c.req.json();

    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.storeId, user.storeId)))
      .limit(1);

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

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

    await db
      .update(customers)
      .set({ lastVisitAt: occurredAt, updatedAt: new Date() })
      .where(eq(customers.id, customerId));

    const [visit] = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
    return c.json({ visit });
  } catch (error) {
    console.error('Create visit error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ===========================
// 登録コードAPI
// ===========================

app.post('/api/registration-codes', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const body = await c.req.json();
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : endOfDay();
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

app.get('/api/registration-codes', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const conditions: any[] = [eq(registrationCodes.storeId, user.storeId)];
    
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

app.get('/api/registration-codes/active', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
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

// ===========================
// ToDoAPI
// ===========================

app.get('/api/todos', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const query = c.req.query();
    const status = query.status || 'pending';
    const limit = parseInt(query.limit || '50');
    const offset = parseInt(query.offset || '0');

    const conditions: any[] = [
      eq(todos.storeId, user.storeId),
      eq(todos.status, status as any),
    ];

    if (user.role === 'cast') {
      conditions.push(eq(todos.castId, user.id));
    }

    const results = await db
      .select({
        todo: todos,
        customer: customers,
      })
      .from(todos)
      .leftJoin(customers, eq(todos.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(todos.dueDate))
      .limit(limit)
      .offset(offset);

    return c.json({ 
      todos: results.map(r => ({ ...r.todo, customer: r.customer }))
    });
  } catch (error) {
    console.error('Get todos error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.patch('/api/todos/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const todoId = c.req.param('id');
    const body = await c.req.json();

    const [todo] = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, todoId), eq(todos.storeId, user.storeId)))
      .limit(1);

    if (!todo) {
      return c.json({ error: 'Todo not found' }, 404);
    }

    if (user.role === 'cast' && todo.castId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'completed') {
        updateData.completedAt = new Date();
      }
    }

    await db.update(todos).set(updateData).where(eq(todos.id, todoId));

    const [updated] = await db.select().from(todos).where(eq(todos.id, todoId)).limit(1);
    return c.json({ todo: updated });
  } catch (error) {
    console.error('Update todo error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ===========================
// メッセージAPI
// ===========================

app.post('/api/messages/send', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const { customerId, message, templateId } = await c.req.json();

    if (!customerId || !message) {
      return c.json({ error: 'Customer ID and message are required' }, 400);
    }

    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.storeId, user.storeId)))
      .limit(1);

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    if (user.role === 'cast' && customer.assignedCastId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (customer.messagingStatus !== 'active') {
      return c.json({ 
        error: 'Cannot send message to inactive customer',
        status: customer.messagingStatus 
      }, 400);
    }

    const [store] = await db.select().from(stores).where(eq(stores.id, user.storeId)).limit(1);

    if (!store) {
      return c.json({ error: 'Store not found' }, 404);
    }

    if (!isWithinAllowedSendingTime(store.allowedSendingStartTime, store.allowedSendingEndTime)) {
      return c.json({ 
        error: 'Message sending is not allowed at this time',
        allowedTime: `${store.allowedSendingStartTime} - ${store.allowedSendingEndTime}`
      }, 400);
    }

    if (!canSendMessage(
      customer.lastMessageSentAt ? new Date(customer.lastMessageSentAt) : null,
      store.messagingFrequencyLimitHours
    )) {
      return c.json({ 
        error: 'Message frequency limit exceeded',
        limitHours: store.messagingFrequencyLimitHours
      }, 429);
    }

    const [channel] = await db
      .select()
      .from(lineChannels)
      .where(and(eq(lineChannels.storeId, user.storeId), eq(lineChannels.isActive, true)))
      .limit(1);

    if (!channel) {
      return c.json({ error: 'LINE channel not configured' }, 404);
    }

    const lineClient = new LineMessagingClient(channel.channelAccessToken);
    const result = await lineClient.pushMessage(customer.lineUserId, message);

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

    if (result.success) {
      await db
        .update(customers)
        .set({ lastMessageSentAt: new Date(), updatedAt: new Date() })
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

app.post('/api/messages/draft', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const { customerId, templateId } = await c.req.json();

    if (!customerId || !templateId) {
      return c.json({ error: 'Customer ID and template ID are required' }, 400);
    }

    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.storeId, user.storeId)))
      .limit(1);

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const [template] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.storeId, user.storeId)))
      .limit(1);

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    if (template.scope === 'cast' && template.ownerCastId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const [store] = await db.select().from(stores).where(eq(stores.id, user.storeId)).limit(1);

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

// ===========================
// テンプレートAPI
// ===========================

app.get('/api/templates', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');

    const results = await db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.storeId, user.storeId),
          or(
            eq(templates.scope, 'store'),
            and(eq(templates.scope, 'cast'), eq(templates.ownerCastId, user.id))
          )
        )
      )
      .orderBy(templates.type, templates.title);

    return c.json({ templates: results });
  } catch (error) {
    console.error('Get templates error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/templates', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');
    const { scope, type, title, body: templateBody } = await c.req.json();

    if (!scope || !type || !title || !templateBody) {
      return c.json({ error: 'All fields are required' }, 400);
    }

    if (scope === 'store' && user.role !== 'manager') {
      return c.json({ error: 'Only managers can create store templates' }, 403);
    }

    const templateId = generateId('tmpl');
    await db.insert(templates).values({
      id: templateId,
      storeId: user.storeId,
      scope,
      ownerCastId: scope === 'cast' ? user.id : null,
      type,
      title,
      body: templateBody,
    });

    const [created] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    return c.json({ template: created });
  } catch (error) {
    console.error('Create template error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ===========================
// ユーザー管理API
// ===========================

app.get('/api/users', async (c) => {
  try {
    const user = c.get('user');
    if (!user || user.role !== 'manager') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    const db = c.get('db');

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

app.get('/api/users/casts', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const db = c.get('db');

    const casts = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(eq(users.storeId, user.storeId), eq(users.role, 'cast')))
      .orderBy(users.displayName);

    return c.json({ casts });
  } catch (error) {
    console.error('Get casts error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ===========================
// LINE Webhook
// ===========================

app.post('/webhook/line', async (c) => {
  try {
    const db = c.get('db');
    const signature = c.req.header('x-line-signature');
    
    if (!signature) {
      return c.json({ error: 'Missing signature' }, 401);
    }

    const bodyText = await c.req.text();
    const body = JSON.parse(bodyText);

    const destination = body.destination;
    if (!destination) {
      return c.json({ error: 'Missing destination' }, 400);
    }

    const [channel] = await db
      .select()
      .from(lineChannels)
      .where(eq(lineChannels.botUserId, destination))
      .limit(1);

    if (!channel) {
      console.error('Channel not found for destination:', destination);
      return c.json({ error: 'Channel not found' }, 404);
    }

    const isValid = await verifyLineSignature(bodyText, signature, channel.channelSecret);
    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // イベント処理（簡略版 - 実際の処理はwebhook.tsを参照）
    console.log('LINE webhook received:', body);

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ===========================
// ヘルスチェック
// ===========================

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===========================
// フロントエンド
// ===========================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ナイトワーク顧客管理CRM</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-900 text-white">
        <div class="min-h-screen flex items-center justify-center p-4">
            <div class="max-w-md w-full space-y-8">
                <div class="text-center">
                    <h1 class="text-4xl font-bold mb-2">
                        <i class="fas fa-users mr-2"></i>
                        顧客管理CRM
                    </h1>
                    <p class="text-gray-400">ナイトワーク店舗向けLINE連携システム</p>
                </div>
                
                <div class="bg-gray-800 rounded-lg p-8 space-y-6">
                    <div id="error-message" class="hidden bg-red-500 text-white p-3 rounded"></div>
                    
                    <form id="login-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">メールアドレス</label>
                            <input 
                                type="email" 
                                name="email" 
                                required
                                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                placeholder="email@example.com"
                            />
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2">パスワード</label>
                            <input 
                                type="password" 
                                name="password" 
                                required
                                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                placeholder="••••••••"
                            />
                        </div>
                        
                        <button 
                            type="submit"
                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
                        >
                            ログイン
                        </button>
                    </form>
                    
                    <div class="text-center text-sm text-gray-500">
                        <p>テスト: cast1@example.com / password123</p>
                    </div>
                </div>
                
                <div class="text-center text-sm text-gray-400">
                    <p>キャスト・マネージャー専用システム</p>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const form = document.getElementById('login-form');
            const errorDiv = document.getElementById('error-message');
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errorDiv.classList.add('hidden');
                
                const formData = new FormData(form);
                const email = formData.get('email');
                const password = formData.get('password');
                
                try {
                    const response = await axios.post('/api/auth/login', {
                        email,
                        password
                    });
                    
                    window.location.href = '/dashboard';
                } catch (error) {
                    errorDiv.textContent = error.response?.data?.error || 'ログインに失敗しました';
                    errorDiv.classList.remove('hidden');
                }
            });
        </script>
    </body>
    </html>
  `);
});

app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ダッシュボード - CRM</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-900 text-white">
        <div class="min-h-screen">
            <header class="bg-gray-800 border-b border-gray-700 p-4">
                <div class="flex justify-between items-center">
                    <h1 class="text-xl font-bold">
                        <i class="fas fa-users mr-2"></i>
                        顧客管理CRM
                    </h1>
                    <button id="logout-btn" class="text-red-400 hover:text-red-300">
                        <i class="fas fa-sign-out-alt mr-1"></i>
                        ログアウト
                    </button>
                </div>
            </header>
            
            <main class="p-4 max-w-7xl mx-auto">
                <div id="loading" class="text-center py-8">
                    <i class="fas fa-spinner fa-spin text-3xl"></i>
                </div>
                
                <div id="content" class="hidden space-y-6">
                    <div class="bg-gray-800 rounded-lg p-6">
                        <h2 class="text-lg font-semibold mb-4">ユーザー情報</h2>
                        <div id="user-info" class="space-y-2"></div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <a href="/customers" class="bg-blue-600 hover:bg-blue-700 rounded-lg p-6 text-center transition block">
                            <i class="fas fa-users text-3xl mb-2"></i>
                            <div class="font-semibold">顧客一覧</div>
                        </a>
                        
                        <a href="/todos" class="bg-green-600 hover:bg-green-700 rounded-lg p-6 text-center transition block">
                            <i class="fas fa-tasks text-3xl mb-2"></i>
                            <div class="font-semibold">今日のToDo</div>
                        </a>
                        
                        <a href="/registration-codes" class="bg-purple-600 hover:bg-purple-700 rounded-lg p-6 text-center transition block">
                            <i class="fas fa-qrcode text-3xl mb-2"></i>
                            <div class="font-semibold">登録コード</div>
                        </a>
                    </div>
                    
                    <div class="bg-gray-800 rounded-lg p-6">
                        <h2 class="text-lg font-semibold mb-4">システム状態</h2>
                        <div class="text-green-400">
                            <i class="fas fa-check-circle mr-2"></i>
                            正常稼働中
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            async function loadUserInfo() {
                try {
                    const response = await axios.get('/api/auth/me');
                    const user = response.data.user;
                    
                    document.getElementById('user-info').innerHTML = \`
                        <div><strong>名前:</strong> \${user.displayName}</div>
                        <div><strong>役割:</strong> \${user.role === 'manager' ? 'マネージャー' : 'キャスト'}</div>
                        <div><strong>メール:</strong> \${user.email}</div>
                    \`;
                    
                    document.getElementById('loading').classList.add('hidden');
                    document.getElementById('content').classList.remove('hidden');
                } catch (error) {
                    window.location.href = '/';
                }
            }
            
            document.getElementById('logout-btn').addEventListener('click', async () => {
                try {
                    await axios.post('/api/auth/logout');
                    window.location.href = '/';
                } catch (error) {
                    console.error('Logout error:', error);
                }
            });
            
            loadUserInfo();
        </script>
    </body>
    </html>
  `);
});

export default app;

// Cloudflare Cron Trigger
export const scheduled: ExportedHandler<Bindings>['scheduled'] = async (event, env, ctx) => {
  console.log('[Scheduled] Cron trigger started:', new Date().toISOString());
  const db = createDb(env.DB);
  
  try {
    await generateTodosForAllStores(db);
    console.log('[Scheduled] Cron trigger completed successfully');
  } catch (error) {
    console.error('[Scheduled] Cron trigger error:', error);
  }
};
