// api/routes/listViews.js
import express from 'express';
import { pool } from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = express.Router();

/**
 * GET /api/content-types/:id/list-views?role=ADMIN
 * Returns all list views for a given content type + role.
 */
router.get(
  '/content-types/:id/list-views',
  authMiddleware,
  checkPermission('view_content_types'),
  async (req, res) => {
    const { id } = req.params;
    const role = (req.query.role || '').toString().toUpperCase() || 'ADMIN';

    try {
      const { rows } = await pool.query(
        `
          SELECT
            id,
            content_type_id,
            slug,
            label,
            role,
            is_default,
            config,
            created_at,
            updated_at
          FROM entry_list_views
          WHERE content_type_id = $1
            AND role = $2
          ORDER BY is_default DESC, created_at ASC
        `,
        [id, role]
      );

      res.json({ views: rows || [] });
    } catch (err) {
      console.error('[GET /content-types/:id/list-views] error', err);
      res.status(500).json({ error: 'Failed to load list views' });
    }
  }
);

/**
 * PUT /api/content-types/:id/list-view
 * Body: { slug, label, role, is_default, config: { columns: [...] } }
 * Upserts a single list view for this content type + slug + role.
 */
router.put(
  '/content-types/:id/list-view',
  authMiddleware,
  checkPermission('manage_content_types'),
  async (req, res) => {
    const { id } = req.params;
    let {
      slug,
      label,
      role,
      is_default = false,
      config = {},
    } = req.body || {};

    slug = (slug || '').toString().trim();
    label = (label || '').toString().trim();
    role = (role || 'ADMIN').toString().toUpperCase();

    if (!slug || !label) {
      return res.status(400).json({ error: 'Slug and label are required' });
    }

    // Sanity-check columns so a bad payload doesn’t blow things up
    if (
      !config ||
      typeof config !== 'object' ||
      !Array.isArray(config.columns)
    ) {
      config = { columns: [] };
    }

    try {
      await pool.query('BEGIN');

      // If this is becoming the default, clear other defaults for this type + role
      if (is_default) {
        await pool.query(
          `
            UPDATE entry_list_views
            SET is_default = FALSE
            WHERE content_type_id = $1
              AND role = $2
          `,
          [id, role]
        );
      }

      // Upsert by (content_type_id, slug, role)
      const { rows } = await pool.query(
        `
          INSERT INTO entry_list_views (
            content_type_id,
            slug,
            label,
            role,
            is_default,
            config
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (content_type_id, slug, role)
          DO UPDATE SET
            label      = EXCLUDED.label,
            is_default = EXCLUDED.is_default,
            config     = EXCLUDED.config,
            updated_at = NOW()
          RETURNING
            id,
            content_type_id,
            slug,
            label,
            role,
            is_default,
            config,
            created_at,
            updated_at
        `,
        [id, slug, label, role, !!is_default, config]
      );

      await pool.query('COMMIT');

      const view = rows[0];
      res.json({ view });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('[PUT /content-types/:id/list-view] error', err);
      res.status(500).json({ error: 'Failed to save list view' });
    }
  }
);

export default router;
