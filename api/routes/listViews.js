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
  // Fetch all list views for the given content type.  We do not filter by
  // "role" at the database layer anymore because a single view may apply
  // to multiple roles.  Instead we return all rows and the caller should
  // decide which ones to display.  The legacy `role` column is still
  // populated, but the true list of roles for a view lives in
  // `config.roles` (array of strings).  The default roles live in
  // `config.default_roles` (array of strings).
  const { rows } = await pool.query(
    `
      SELECT id, content_type_id, slug, label, role, is_default, config
      FROM entry_list_views
      WHERE content_type_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [contentTypeId]
  );
  // If a specific role was requested, filter views to those that list
  // the role in the config.roles array (or fall back to legacy role
  // column if the config does not specify roles).  Role names are
  // compared case‑insensitively.
  const roleValue = (role || 'ADMIN').toUpperCase();
  return rows.filter((row) => {
    const cfg = row.config || {};
    const roles = Array.isArray(cfg.roles)
      ? cfg.roles.map((r) => String(r || '').toUpperCase())
      : row.role
      ? [String(row.role || '').toUpperCase()]
      : [];
    // If no roles are defined, assume the view is available for all roles.
    if (roles.length === 0) return true;
    return roles.includes(roleValue);
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/content-types/:id/list-views?role=ADMIN
 * Returns all list views for a given content type + role.
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 * IMPORTANT: returns a plain array for backwards compatibility.
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

      // NOTE: returning the raw array keeps existing frontend logic working.
      return res.json(views);
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
    // Accept either legacy singular role/is_default or new roles/default_roles arrays.
    // We will upsert a row per role so that each role has its own record in
    // entry_list_views, with the same slug and config.  This keeps the
    // existing table structure intact while supporting multiple roles and
    // default assignments.
    const client = await pool.connect();
    try {
      const { id: idOrSlug } = req.params;
      let {
        slug,
        label,
        role,
        roles,
        is_default: isDefault,
        default_roles,
        config,
      } = req.body || {};

      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({ error: 'slug is required' });
      }
      // Normalize roles.  Accept either a single "role" string or an array of
      // "roles".  If neither is provided, default to [req.user.role || 'ADMIN'].
      let roleList;
      if (Array.isArray(roles) && roles.length > 0) {
        roleList = roles;
      } else if (typeof role === 'string' && role.trim()) {
        roleList = [role];
      } else {
        // Fall back to the current user's role, or ADMIN if none provided.
        const fallbackRole = req.user?.role || 'ADMIN';
        roleList = [fallbackRole];
      }
      roleList = roleList.map((r) => String(r || '').toUpperCase());

      // Normalize default roles list.  If default_roles array is provided,
      // uppercase its contents.  Otherwise use a single is_default boolean for
      // legacy behaviour.
      let defaultRoleList;
      if (Array.isArray(default_roles)) {
        defaultRoleList = default_roles.map((r) => String(r || '').toUpperCase());
      } else if (typeof isDefault === 'boolean' && isDefault === true) {
        // Legacy: if is_default is true, treat all roles as default roles.
        defaultRoleList = [...roleList];
      } else {
        defaultRoleList = [];
      }

      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }
      await client.query('BEGIN');
      // Upsert a row per role.  For each role in roleList, either insert a new
      // entry_list_views row or update the existing one (identified by
      // content_type_id + slug + role).  If the role is in defaultRoleList,
      // mark it as default.  Otherwise, mark as non-default.
      const upsertResults = [];
      for (const roleValueRaw of roleList) {
        const roleValue = roleValueRaw.toUpperCase();
        const isDefaultForRole = defaultRoleList.includes(roleValue);
        // Clear any other list views marked as default for this type+role.
        if (isDefaultForRole) {
          await client.query(
            `UPDATE entry_list_views
               SET is_default = FALSE
             WHERE content_type_id = $1
               AND role = $2`,
            [contentTypeId, roleValue]
          );
        }
        // Check for existing row for this role
        const { rows: existingRows } = await client.query(
          `SELECT id
             FROM entry_list_views
            WHERE content_type_id = $1
              AND slug = $2
              AND role = $3
            LIMIT 1`,
          [contentTypeId, slug, roleValue]
        );
        let savedRow;
        if (existingRows.length > 0) {
          // Update existing
          const { rows: updateRows } = await client.query(
            `UPDATE entry_list_views
                SET label = $1,
                    is_default = $2,
                    config = $3,
                    updated_at = NOW()
              WHERE id = $4
              RETURNING id, content_type_id, slug, label, role, is_default, config`,
            [
              label || slug,
              isDefaultForRole,
              // Merge in roles/default_roles into config
              {
                ...(config || {}),
                roles: roleList,
                default_roles: defaultRoleList,
              },
              existingRows[0].id,
            ]
          );
          savedRow = updateRows[0];
        } else {
          // Insert new
          const { rows: insertRows } = await client.query(
            `INSERT INTO entry_list_views
                (content_type_id, slug, label, role, is_default, config)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, content_type_id, slug, label, role, is_default, config`,
            [
              contentTypeId,
              slug,
              label || slug,
              roleValue,
              isDefaultForRole,
              {
                ...(config || {}),
                roles: roleList,
                default_roles: defaultRoleList,
              },
            ]
          );
          savedRow = insertRows[0];
        }
        upsertResults.push(savedRow);
      }
      await client.query('COMMIT');
      // Return all updated/inserted rows for the caller.
      return res.json({ views: upsertResults });
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
