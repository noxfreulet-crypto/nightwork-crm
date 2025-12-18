import { Hono } from 'hono';
import { eq, and, or } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { templates } from '../db/schema';
import { generateId } from '../lib/utils';
import type { Variables } from '../middleware/auth';
import { requireAuth, requireRole } from '../middleware/auth';

export function createTemplatesRoutes(db: DbClient) {
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', requireAuth());

  /**
   * テンプレート一覧取得
   */
  app.get('/', async (c) => {
    try {
      const user = c.get('user')!;

      // 店舗テンプレート + 自分のキャストテンプレート
      const results = await db
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.storeId, user.storeId),
            or(
              eq(templates.scope, 'store'),
              and(
                eq(templates.scope, 'cast'),
                eq(templates.ownerCastId, user.id)
              )
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

  /**
   * テンプレート作成
   */
  app.post('/', async (c) => {
    try {
      const user = c.get('user')!;
      const body = await c.req.json();

      const { scope, type, title, body: templateBody } = body;

      if (!scope || !type || !title || !templateBody) {
        return c.json({ error: 'All fields are required' }, 400);
      }

      // 店舗テンプレートはマネージャーのみ作成可能
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

  /**
   * テンプレート更新
   */
  app.patch('/:id', async (c) => {
    try {
      const user = c.get('user')!;
      const templateId = c.req.param('id');
      const body = await c.req.json();

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

      // 店舗テンプレートはマネージャーのみ編集可能
      if (template.scope === 'store' && user.role !== 'manager') {
        return c.json({ error: 'Only managers can edit store templates' }, 403);
      }

      // キャストテンプレートは所有者のみ編集可能
      if (template.scope === 'cast' && template.ownerCastId !== user.id) {
        return c.json({ error: 'You can only edit your own templates' }, 403);
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.title !== undefined) {
        updateData.title = body.title;
      }
      if (body.body !== undefined) {
        updateData.body = body.body;
      }
      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }

      await db
        .update(templates)
        .set(updateData)
        .where(eq(templates.id, templateId));

      const [updated] = await db
        .select()
        .from(templates)
        .where(eq(templates.id, templateId))
        .limit(1);

      return c.json({ template: updated });
    } catch (error) {
      console.error('Update template error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * テンプレート削除
   */
  app.delete('/:id', async (c) => {
    try {
      const user = c.get('user')!;
      const templateId = c.req.param('id');

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

      // 店舗テンプレートはマネージャーのみ削除可能
      if (template.scope === 'store' && user.role !== 'manager') {
        return c.json({ error: 'Only managers can delete store templates' }, 403);
      }

      // キャストテンプレートは所有者のみ削除可能
      if (template.scope === 'cast' && template.ownerCastId !== user.id) {
        return c.json({ error: 'You can only delete your own templates' }, 403);
      }

      await db
        .delete(templates)
        .where(eq(templates.id, templateId));

      return c.json({ success: true });
    } catch (error) {
      console.error('Delete template error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
