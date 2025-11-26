// api/routes/editorViews.js
import express from 'express';
import { pool } from '../dbPool.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/content-types/:id/editor-view?role=ADMIN
 * Returns the config for this content type + role.
 * Falls back to role IS NULL, or {} if none.
 */
router.get(
  '/content-types/:id/editor-view',
  authMiddleware,
  async (req, res) => {
    const { id } = req.params;
    const role = req.query.role || null;

    try {
      const params = [id];
      let sql = `
        select *
        from entry_editor_views
        where content_type_id = $1
      `;

      if (role) {
        sql += ' and (role = $2 or role is null) order by role nulls last limit 1';
        params.push(role);
      } else {
        sql += ' and role is null limit 1';
      }

      const { rows } = await pool.query(sql, params);

      if (!rows.length) {
        return res.json({
          content_type_id: id,
          role: role,
          slug: 'default',
          label: 'Default editor',
          config: {},   // frontend will auto-generate layout
        });
      }

      const view = rows[0];
      return res.json({
        id: view.id,
        content_type_id: view.content_type_id,
        slug: view.slug,
        label: view.label,
        role: view.role,
        config: view.config || {},
      });
    } catch (err) {
      console.error('[GET /content-types/:id/editor-view]', err);
      return res.status(500).json({ error: 'Failed to load editor view' });
    }
  }
);

/**
 * PUT /api/content-types/:id/editor-view
 * Upserts a view for this content type + role.
 * For now we’ll gate this to admins.
 */
router.put(
  '/content-types/:id/editor-view',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { slug = 'default', label = 'Default editor', role = null, config = {} } = req.body || {};

    try {
      const { rows } = await pool.query(
        `
        insert into entry_editor_views (content_type_id, slug, label, role, config)
        values ($1, $2, $3, $4, $5)
        on conflict (content_type_id, slug, role)
        do update set
          label = excluded.label,
          config = excluded.config,
          updated_at = now()
        returning *
        `,
        [id, slug, label, role, config]
      );

      return res.json(rows[0]);
    } catch (err) {
      console.error('[PUT /content-types/:id/editor-view]', err);
      return res.status(500).json({ error: 'Failed to save editor view' });
    }
  }
);

export default router;
