// api/routes/editorViews.js
import express from 'express';
import { pool } from '../dbPool.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = express.Router();

/**
 * Helper: fetch the "default" editor view for a content type + role.
 * If none exists, returns null.
 */
async function getDefaultEditorView(contentTypeId, role) {
  const { rows } = await pool.query(
    `
    SELECT *
    FROM entry_editor_views
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
 * GET /api/content-types/:id/editor-views?role=ADMIN
 * Returns ALL views for this content type + role.
 * This is used by Settings → Entry Views.
 */
router.get(
  '/content-types/:id/editor-views',
  checkPermission('manage_content_types'),
  async (req, res) => {
    const { id } = req.params;
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({ error: 'Missing role query param' });
    }

    try {
      // Ensure content type exists
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
        FROM entry_editor_views
        WHERE content_type_id = $1
          AND role = $2
        ORDER BY is_default DESC, label ASC
        `,
        [id, role]
      );

      return res.json({ views: rows });
    } catch (err) {
      console.error('[GET /content-types/:id/editor-views]', err);
      return res
        .status(500)
        .json({ error: 'Failed to fetch editor views' });
    }
  }
);

/**
 * GET /api/content-types/:id/editor-view?role=ADMIN
 * Returns the chosen/default view for this type + role.
 * If none is stored, returns a synthetic empty config.
 * This is used by the actual entry editor page.
 */
router.get(
  '/content-types/:id/editor-view',
  // viewing the editor layout is a weaker permission than editing it
  checkPermission('view_content_types'),
  async (req, res) => {
    const { id } = req.params;
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({ error: 'Missing role query param' });
    }

    try {
      // Ensure content type exists
      const ctRes = await pool.query(
        'SELECT id FROM content_types WHERE id = $1',
        [id]
      );
      if (!ctRes.rows.length) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      const view = await getDefaultEditorView(id, role);
      if (!view) {
        // No stored view; return a synthetic default
        return res.json({
          slug: 'default',
          label: 'Default editor',
          role,
          is_default: false,
          config: {},
        });
      }

      return res.json(view);
    } catch (err) {
      console.error('[GET /content-types/:id/editor-view]', err);
      return res
        .status(500)
        .json({ error: 'Failed to fetch editor view' });
    }
  }
);

/**
 * PUT /api/content-types/:id/editor-view
 * Upserts a single view for a content type + role + slug.
 * Body: { slug, label, role, is_default?, config }
 */
router.put(
  '/content-types/:id/editor-view',
  checkPermission('manage_content_types'),
  async (req, res) => {
    const { id } = req.params;
    let { slug, label, role, is_default, config } = req.body || {};

    if (!slug || !label || !role) {
      return res
        .status(400)
        .json({ error: 'slug, label, and role are required' });
    }

    // Basic normalization
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
      // Ensure content type exists
      const ctRes = await client.query(
        'SELECT id FROM content_types WHERE id = $1',
        [id]
      );
      if (!ctRes.rows.length) {
        client.release();
        return res.status(404).json({ error: 'Content type not found' });
      }

      await client.query('BEGIN');

      // If this is marked as default, clear existing default for this type+role
      if (isDefault) {
        await client.query(
          `
          UPDATE entry_editor_views
          SET is_default = false
          WHERE content_type_id = $1
            AND role = $2
          `,
          [id, role]
        );
      }

      // Upsert by (content_type_id, role, slug)
      const upsertRes = await client.query(
        `
        INSERT INTO entry_editor_views (content_type_id, slug, label, role, is_default, config)
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
      console.error('[PUT /content-types/:id/editor-view]', err);
      return res.status(500).json({ error: 'Failed to save editor view' });
    } finally {
      client.release();
    }
  }
);

export default router;
