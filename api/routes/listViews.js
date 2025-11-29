// api/routes/listViews.js
import express from 'express';
import { pool } from '../dbPool.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = express.Router();

/**
 * Helper: fetch the default list view for a content type + role.
 */
async function getDefaultListView(contentTypeId, role) {
  const { rows } = await pool.query(
    `
    SELECT id, content_type_id, slug, label, role, is_default, config
    FROM entry_list_views
    WHERE content_type_id = $1
      AND role = $2
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
    `,
    [contentTypeId, role]
  );
  return rows[0] || null;
}

/**
 * GET /api/content-types/:id/list-views?role=ADMIN
 * Returns ALL list views for this content type + role.
 * (Used by Settings → List Views page we’ll build next.)
 */
router.get(
  '/content-types/:id/list-views',
  checkPermission('manage_content_types'),
  async (req, res) => {
    const { id } = req.params;
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({ error: 'Missing role query param' });
    }

    try {
      const ctRes = await pool.query(
        'SELECT id FROM content_types WHERE id = $1',
        [id]
      );
      if (!ctRes.rows.length) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      const { rows } = await pool.query(
        `
        SELECT id, content_type_id, slug, label, role, is_default, config
        FROM entry_list_views
        WHERE content_type_id = $1
          AND role = $2
        ORDER BY is_default DESC, label ASC
        `,
        [id, role]
      );

      return res.json({ views: rows });
    } catch (err) {
      console.error('[GET /content-types/:id/list-views]', err);
      return res.status(500).json({ error: 'Failed to fetch list views' });
    }
  }
);

/**
 * GET /api/content-types/:id/list-view?role=ADMIN
 * Returns the chosen/default list view for this type + role.
 * If none exists, returns a synthetic config so entries can still render.
 * (Used by the Entries table page.)
 */
router.get(
  '/content-types/:id/list-view',
  checkPermission('view_content_types'),
  async (req, res) => {
    const { id } = req.params;
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({ error: 'Missing role query param' });
    }

    try {
      const ctRes = await pool.query(
        'SELECT id, slug, name FROM content_types WHERE id = $1',
        [id]
      );
      if (!ctRes.rows.length) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      const ct = ctRes.rows[0];
      const view = await getDefaultListView(id, role);

      if (!view) {
        // No stored view; synthesize a config with basic columns.
        const fallbackConfig = {
          columns: [
            { key: 'title', label: 'Title' },
            { key: 'status', label: 'Status' },
            { key: 'updated_at', label: 'Updated' },
          ],
        };
        return res.json({
          slug: 'default',
          label: 'Default list',
          role,
          is_default: false,
          config: fallbackConfig,
        });
      }

      return res.json(view);
    } catch (err) {
      console.error('[GET /content-types/:id/list-view]', err);
      return res.status(500).json({ error: 'Failed to fetch list view' });
    }
  }
);

/**
 * PUT /api/content-types/:id/list-view
 * Upserts a single list view:
 * Body: { slug, label, role, is_default?, config }
 */
router.put(
  '/content-types/:id/list-view',
  checkPermission('manage_content_types'),
  async (req, res) => {
    const { id } = req.params;
    let { slug, label, role, is_default, config } = req.body || {};

    if (!slug || !label || !role) {
      return res
        .status(400)
        .json({ error: 'slug, label, and role are required' });
    }

    slug = String(slug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-');
    label = String(label).trim();
    role = String(role).trim().toUpperCase();
    const isDefault = !!is_default;

    if (!config || typeof config !== 'object') {
      config = {};
    }

    const client = await pool.connect();
    try {
      const ctRes = await client.query(
        'SELECT id FROM content_types WHERE id = $1',
        [id]
      );
      if (!ctRes.rows.length) {
        client.release();
        return res.status(404).json({ error: 'Content type not found' });
      }

      await client.query('BEGIN');

      if (isDefault) {
        await client.query(
          `
          UPDATE entry_list_views
          SET is_default = false
          WHERE content_type_id = $1
            AND role = $2
          `,
          [id, role]
        );
      }

      const upsertRes = await client.query(
        `
        INSERT INTO entry_list_views (content_type_id, slug, label, role, is_default, config)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (content_type_id, role, slug)
        DO UPDATE
          SET label = EXCLUDED.label,
              is_default = EXCLUDED.is_default,
              config = EXCLUDED.config,
              updated_at = now()
        RETURNING id, content_type_id, slug, label, role, is_default, config
        `,
        [id, slug, label, role, isDefault, config]
      );

      await client.query('COMMIT');
      const row = upsertRes.rows[0];
      return res.json({ view: row });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[PUT /content-types/:id/list-view]', err);
      return res.status(500).json({ error: 'Failed to save list view' });
    } finally {
      client.release();
    }
  }
);

export default router;
