// api/routes/entryViews.js
//
// Routes for managing entry editor views for a given content type.  This
// mirrors the List Views API but uses the `entry_editor_views` table and
// stores an array of widgets (sections) in the config.  Each view can
// apply to multiple roles and designate default roles.  Permission
// checking uses the same 'manage_content_types' permission as List
// Views.  Dynamic :id parameter accepts either a UUID or a type slug.

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
  const queryField = isUuid(raw) ? 'id = $1::uuid' : 'slug = $1';
  const { rows } = await pool.query(
    `SELECT id FROM content_types WHERE ${queryField} LIMIT 1`,
    [raw]
  );
  return rows[0]?.id ?? null;
}

async function getEditorViewsForType(contentTypeId) {
  // Returns all editor view rows for a content type.  Caller should
  // perform role filtering client‑side.  Each row includes id, slug,
  // label, role, is_default and config.
  const { rows } = await pool.query(
    `SELECT id, content_type_id, slug, label, role, is_default, config
       FROM entry_editor_views
       WHERE content_type_id = $1
       ORDER BY created_at ASC, id ASC`,
    [contentTypeId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/content-types/:id/editor-views?role=ADMIN
 * Returns all editor views for a given content type + optional role filter.
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 */
router.get(
  '/content-types/:id/editor-views',
  checkPermission('manage_content_types'),
  async (req, res) => {
    try {
      const { id: idOrSlug } = req.params;
      const roleParam = req.query.role;
      const allParam = req.query.all;
      const role = roleParam
        ? String(roleParam).toUpperCase()
        : (req.user?.role || 'ADMIN').toUpperCase();
      const includeAll = String(allParam).toLowerCase() === 'true';

      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      const views = await getEditorViewsForType(contentTypeId);

      // If includeAll=true or no role provided, return all rows
      if (!roleParam || includeAll) {
        return res.json(views);
      }
      // Otherwise filter by role.  Use config.roles array if present,
      // else fall back to legacy role column.
      const roleValue = role.toUpperCase();
      const filtered = views.filter((row) => {
        const cfg = row.config || {};
        const roles = Array.isArray(cfg.roles)
          ? cfg.roles.map((r) => String(r || '').toUpperCase())
          : row.role
          ? [String(row.role || '').toUpperCase()]
          : [];
        if (roles.length === 0) return true;
        return roles.includes(roleValue);
      });
      return res.json(filtered);
    } catch (err) {
      console.error('[GET /content-types/:id/editor-views]', err);
      return res.status(500).json({ error: 'Failed to load editor views' });
    }
  }
);

/**
 * PUT /api/content-types/:id/editor-view
 * Create or update a single editor view definition for a type + roles.
 *
 * Body:
 *   {
 *     slug: string,
 *     label: string,
 *     roles: ["ADMIN", "EDITOR", ...],
 *     default_roles: ["ADMIN", ...],
 *     sections: [ { id, title, description, layout, fields: [] }, ... ]
 *   }
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 */
router.put(
  '/content-types/:id/editor-view',
  checkPermission('manage_content_types'),
  async (req, res) => {
    const { id: idOrSlug } = req.params;
    let { slug, label, roles, default_roles, sections } = req.body || {};
    // Basic validation
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'slug is required' });
    }
    // Normalize roles
    let roleList;
    if (Array.isArray(roles) && roles.length > 0) {
      roleList = roles.map((r) => String(r || '').toUpperCase());
    } else {
      const fallbackRole = req.user?.role || 'ADMIN';
      roleList = [String(fallbackRole).toUpperCase()];
    }
    // Normalize default roles
    let defaultRoleList;
    if (Array.isArray(default_roles)) {
      defaultRoleList = default_roles.map((r) => String(r || '').toUpperCase());
    } else {
      defaultRoleList = [];
    }
    // Ensure default roles are subset of roles
    defaultRoleList = defaultRoleList.filter((r) => roleList.includes(r));
    // Default label
    const safeLabel = label && typeof label === 'string' && label.trim() ? label.trim() : slug;
    // Resolve content type
    try {
      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }
      // Start transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // ------------------------------------------------------------------
        // Ensure there is only one default editor view per role.
        // If any roles are designated as default in this request, clear those
        // default assignments from all other views for the same content type.
        // This mirrors the behaviour of list views, so that default roles
        // cannot be assigned across multiple editor views simultaneously.
        if (defaultRoleList.length > 0) {
          for (const dRole of defaultRoleList) {
            await client.query(
              `UPDATE entry_editor_views
                   SET is_default = FALSE,
                       config = jsonb_set(
                         COALESCE(config, '{}'::jsonb),
                         '{default_roles}'::text[],
                         '[]'::jsonb,
                         true
                       )
                 WHERE content_type_id = $1
                   AND (config->'default_roles')::jsonb ? $2`,
              [contentTypeId, dRole]
            );
          }
        }

        // Choose a legacy role value to store in the legacy `role` column.
        // We intentionally avoid using the first role from `roleList` to
        // circumvent unique constraints on (content_type_id, role).  Instead,
        // we use the slug as a stand‑in, ensuring uniqueness per view while
        // preserving the true roles in config.roles.  This mirrors the
        // updated list views API behaviour where the `role` column is no
        // longer used for filtering.
        const legacyRoleValue = slug.toUpperCase();
        const isDefaultRow = defaultRoleList.length > 0;
        const newConfig = {
          roles: roleList,
          default_roles: defaultRoleList,
          sections: Array.isArray(sections) ? sections : []
        };
        // Check for existing row(s) with same slug
        const { rows: existingRows } = await client.query(
          `SELECT id FROM entry_editor_views
             WHERE content_type_id = $1 AND slug = $2`,
          [contentTypeId, slug]
        );
        let savedRow;
        if (existingRows.length > 0) {
          // Update first row, remove duplicates if necessary
          const firstId = existingRows[0].id;
          if (existingRows.length > 1) {
            const dupIds = existingRows.slice(1).map((r) => r.id);
            await client.query(
              `DELETE FROM entry_editor_views WHERE id = ANY($1::uuid[])`,
              [dupIds]
            );
          }
          const { rows: updateRows } = await client.query(
            `UPDATE entry_editor_views
                 SET label = $1,
                     role = $2,
                     is_default = $3,
                     config = $4,
                     updated_at = NOW()
               WHERE id = $5
               RETURNING id, content_type_id, slug, label, role, is_default, config`,
            [safeLabel, legacyRoleValue, isDefaultRow, newConfig, firstId]
          );
          savedRow = updateRows[0];
        } else {
          const { rows: insertRows } = await client.query(
            `INSERT INTO entry_editor_views
               (content_type_id, slug, label, role, is_default, config)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, content_type_id, slug, label, role, is_default, config`,
            [contentTypeId, slug, safeLabel, legacyRoleValue, isDefaultRow, newConfig]
          );
          savedRow = insertRows[0];
        }
        await client.query('COMMIT');
        return res.json({ view: savedRow });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[PUT /content-types/:id/editor-view]', err);
        return res.status(500).json({ error: 'Failed to save editor view' });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[PUT /content-types/:id/editor-view]', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

/**
 * DELETE /api/content-types/:id/editor-view/:slug
 * Delete editor view(s) for a given content type.  If a `role` query
 * parameter is provided, only the row matching that legacy role is deleted.
 * Otherwise, all rows for the slug are removed.  This ensures slug
 * uniqueness across roles.
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 */
router.delete(
  '/content-types/:id/editor-view/:slug',
  checkPermission('manage_content_types'),
  async (req, res) => {
    const { id: idOrSlug, slug } = req.params;
    const roleParam = (req.query.role || '').trim().toUpperCase();
    try {
      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }
      if (!slug) {
        return res.status(400).json({ error: 'slug is required' });
      }
      if (roleParam) {
        // Delete only rows matching this legacy role
        await pool.query(
          `DELETE FROM entry_editor_views
             WHERE content_type_id = $1
               AND slug = $2
               AND role = $3`,
          [contentTypeId, slug, roleParam]
        );
      } else {
        // Delete all rows for this slug (all roles)
        await pool.query(
          `DELETE FROM entry_editor_views
             WHERE content_type_id = $1
               AND slug = $2`,
          [contentTypeId, slug]
        );
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('[DELETE /content-types/:id/editor-view/:slug]', err);
      return res.status(500).json({ error: 'Failed to delete editor view' });
    }
  }
);

export default router;
