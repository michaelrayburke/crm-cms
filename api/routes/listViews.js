// api/routes/listViews.js
import express from 'express';
import { pool } from '../dbPool.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

async function resolveContentTypeId(idOrSlug) {
  if (!idOrSlug) return null;
  const raw = String(idOrSlug).trim();
  const isId = isUuid(raw);
  const where = isId ? 'id = $1::uuid' : 'slug = $1';

  const { rows } = await pool.query(
    `
      SELECT id
      FROM content_types
      WHERE ${where}
    `,
    [raw]
  );

  return rows[0]?.id ?? null;
}

async function getListViewsForTypeAndRole(contentTypeId, role) {
  const roleValue = (role || 'ADMIN').toUpperCase();
  const { rows } = await pool.query(
    `
      SELECT id, content_type_id, slug, label, role, is_default, config
      FROM entry_list_views
      WHERE content_type_id = $1
        AND role = $2
      ORDER BY created_at ASC, id ASC
    `,
    [contentTypeId, roleValue]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/content-types/:id/list-views?role=ADMIN
 * Returns all list views for a given content type + role.
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 */
router.get(
  '/content-types/:id/list-views',
  checkPermission('manage_content_types'),
  async (req, res) => {
    try {
      const { id: idOrSlug } = req.params;
      const role = (req.query.role || req.user?.role || 'ADMIN').toUpperCase();

      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      const views = await getListViewsForTypeAndRole(contentTypeId, role);
      return res.json({ views });
    } catch (err) {
      console.error('[GET /content-types/:id/list-views]', err);
      return res.status(500).json({ error: 'Failed to load list views' });
    }
  }
);

/**
 * PUT /api/content-types/:id/list-view
 * Create or update a single list view definition for a type + role.
 *
 * Body:
 *   {
 *     slug: string,
 *     label: string,
 *     role: "ADMIN" | "EDITOR" | "...",
 *     is_default: boolean,
 *     config: { columns: [{ key, label, ... }] }
 *   }
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 */
router.put(
  '/content-types/:id/list-view',
  checkPermission('manage_content_types'),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { id: idOrSlug } = req.params;
      const {
        slug,
        label,
        role,
        is_default: isDefault,
        config,
      } = req.body || {};

      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({ error: 'slug is required' });
      }
      if (!role || typeof role !== 'string') {
        return res.status(400).json({ error: 'role is required' });
      }

      const roleValue = role.toUpperCase();

      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      await client.query('BEGIN');

      // If this view should be the default, clear others for this type+role.
      if (isDefault) {
        await client.query(
          `
            UPDATE entry_list_views
            SET is_default = FALSE
            WHERE content_type_id = $1
              AND role = $2
          `,
          [contentTypeId, roleValue]
        );
      }

      const findSql = `
        SELECT id
        FROM entry_list_views
        WHERE content_type_id = $1
          AND slug = $2
          AND role = $3
        LIMIT 1
      `;
      const existingRes = await client.query(findSql, [
        contentTypeId,
        slug,
        roleValue,
      ]);

      let savedRow;

      if (existingRes.rows.length) {
        const updateSql = `
          UPDATE entry_list_views
          SET
            label = $1,
            is_default = $2,
            config = $3,
            updated_at = NOW()
          WHERE id = $4
          RETURNING id, content_type_id, slug, label, role, is_default, config
        `;
        const updateRes = await client.query(updateSql, [
          label || slug,
          !!isDefault,
          config || {},
          existingRes.rows[0].id,
        ]);
        savedRow = updateRes.rows[0];
      } else {
        const insertSql = `
          INSERT INTO entry_list_views
            (content_type_id, slug, label, role, is_default, config)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, content_type_id, slug, label, role, is_default, config
        `;
        const insertRes = await client.query(insertSql, [
          contentTypeId,
          slug,
          label || slug,
          roleValue,
          !!isDefault,
          config || {},
        ]);
        savedRow = insertRes.rows[0];
      }

      await client.query('COMMIT');
      return res.json({ view: savedRow });
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
