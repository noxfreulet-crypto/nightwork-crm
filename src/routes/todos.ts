import { Hono } from 'hono';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { todos, customers } from '../db/schema';
import { generateId } from '../lib/utils';
import type { Variables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

export function createTodosRoutes(db: DbClient) {
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', requireAuth());

  /**
   * ToDo一覧取得
   */
  app.get('/', async (c) => {
    try {
      const user = c.get('user')!;
      const query = c.req.query();

      const status = query.status || 'pending';
      const limit = parseInt(query.limit || '50');
      const offset = parseInt(query.offset || '0');

      const conditions = [
        eq(todos.storeId, user.storeId),
        eq(todos.status, status as any),
      ];

      // キャストは自分のToDoのみ
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
        todos: results.map(r => ({
          ...r.todo,
          customer: r.customer,
        }))
      });
    } catch (error) {
      console.error('Get todos error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * ToDo詳細取得
   */
  app.get('/:id', async (c) => {
    try {
      const user = c.get('user')!;
      const todoId = c.req.param('id');

      const [result] = await db
        .select({
          todo: todos,
          customer: customers,
        })
        .from(todos)
        .leftJoin(customers, eq(todos.customerId, customers.id))
        .where(
          and(
            eq(todos.id, todoId),
            eq(todos.storeId, user.storeId)
          )
        )
        .limit(1);

      if (!result) {
        return c.json({ error: 'Todo not found' }, 404);
      }

      // キャストは自分のToDoのみ
      if (user.role === 'cast' && result.todo.castId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      return c.json({ 
        todo: {
          ...result.todo,
          customer: result.customer,
        }
      });
    } catch (error) {
      console.error('Get todo error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * ToDoステータス更新
   */
  app.patch('/:id', async (c) => {
    try {
      const user = c.get('user')!;
      const todoId = c.req.param('id');
      const body = await c.req.json();

      const [todo] = await db
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.id, todoId),
            eq(todos.storeId, user.storeId)
          )
        )
        .limit(1);

      if (!todo) {
        return c.json({ error: 'Todo not found' }, 404);
      }

      // キャストは自分のToDoのみ
      if (user.role === 'cast' && todo.castId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.status) {
        updateData.status = body.status;
        if (body.status === 'completed') {
          updateData.completedAt = new Date();
        }
      }

      await db
        .update(todos)
        .set(updateData)
        .where(eq(todos.id, todoId));

      const [updated] = await db
        .select()
        .from(todos)
        .where(eq(todos.id, todoId))
        .limit(1);

      return c.json({ todo: updated });
    } catch (error) {
      console.error('Update todo error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * 今日のToDo取得
   */
  app.get('/today/list', async (c) => {
    try {
      const user = c.get('user')!;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const conditions = [
        eq(todos.storeId, user.storeId),
        eq(todos.status, 'pending'),
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
        .orderBy(todos.dueDate);

      return c.json({ 
        todos: results.map(r => ({
          ...r.todo,
          customer: r.customer,
        }))
      });
    } catch (error) {
      console.error('Get today todos error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
