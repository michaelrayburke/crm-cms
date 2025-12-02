// api/routes/listViews.js (updated version)
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
  // If no role or role is falsy, return all rows (used when includeAll=true).
  if (!role) {
    return rows;
  }
  // Admins should be able to see all list view definitions for editing. When
  // role is 'ADMIN', the caller can pass all=true to bypass filtering; in
  // that case, role will be undefined. Otherwise, we still filter views used
  // by admin so the list page shows only admin-specific views.
  if (roleValue === 'ADMIN' && role) {
    // Fall through to filtering below to avoid using views for other roles
    // when listing entries. Admin editing can use includeAll=true to see all.
  }
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
      const roleParam = req.query.role;
      const allParam = req.query.all;
      const role = roleParam ? String(roleParam).toUpperCase() : (req.user?.role || 'ADMIN').toUpperCase();
      const includeAll = String(allParam).toLowerCase() === 'true';

      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      // If includeAll=true, skip role filtering by passing null/undefined role to helper.
      const views = await getListViewsForTypeAndRole(contentTypeId, includeAll ? null : role);

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
      // We now store a single row per view with a list of roles in config.roles and
      // default roles in config.default_roles.  First, ensure default roles
      // do not include roles not present in the role list.
      defaultRoleList = defaultRoleList.filter((r) => roleList.includes(r));

      // Clear any other list views marked as default for this content type and roles
      // in defaultRoleList.  This ensures only one default view per role.
      if (defaultRoleList.length > 0) {
        for (const dRole of defaultRoleList) {
          await client.query(
            `UPDATE entry_list_views
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

      // Check for existing rows for this slug regardless of role
      const { rows: existingRows } = await client.query(
        `SELECT id, role
           FROM entry_list_views
          WHERE content_type_id = $1
            AND slug = $2`,
        [contentTypeId, slug]
      );

      let savedRow;
      // Build a config that includes all roles and default roles
      const newConfig = {
        ...(config || {}),
        roles: roleList,
        default_roles: defaultRoleList,
      };
      if (existingRows.length > 0) {
        // Update the first existing row and delete duplicates.  Use the first row as the primary
        const firstId = existingRows[0].id;
        if (existingRows.length > 1) {
          const dupIds = existingRows.slice(1).map((r) => r.id);
          await client.query(
            `DELETE FROM entry_list_views WHERE id = ANY($1::uuid[])`,
            [dupIds]
          );
        }
        // Choose a legacy role value for the updated row. Use the first role in the list.
        const legacyRoleValue = roleList[0] || 'ADMIN';
        // Determine is_default flag.  If any role is default, mark the row as default.
        const isDefaultRow = defaultRoleList.length > 0;
        const { rows: updateRows } = await client.query(
          `UPDATE entry_list_views
              SET label = $1,
                  role = $2,
                  is_default = $3,
                  config = $4,
                  updated_at = NOW()
            WHERE id = $5
            RETURNING id, content_type_id, slug, label, role, is_default, config`,
          [
            label || slug,
            legacyRoleValue,
            isDefaultRow,
            newConfig,
            firstId,
          ]
        );
        savedRow = updateRows[0];
      } else {
        // Insert new row
        const legacyRoleValue = roleList[0] || 'ADMIN';
        const isDefaultRow = defaultRoleList.length > 0;
        const { rows: insertRows } = await client.query(
          `INSERT INTO entry_list_views
              (content_type_id, slug, label, role, is_default, config)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, content_type_id, slug, label, role, is_default, config`,
          [
            contentTypeId,
            slug,
            label || slug,
            legacyRoleValue,
            isDefaultRow,
            newConfig,
          ]
        );
        savedRow = insertRows[0];
      }
      await client.query('COMMIT');
      return res.json({ views: [savedRow] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[PUT /content-types/:id/list-view]', err);
      return res.status(500).json({ error: 'Failed to save list view' });
    } finally {
      client.release();
    }
  }
);

/**
 * DELETE /api/content-types/:id/list-view/:slug
 * Delete a list view for a given content type.  If a `role` query
 * parameter is provided, only the view for that role is deleted.
 * Otherwise all views for the slug are removed.  This endpoint
 * removes any duplicates and ensures slug uniqueness.
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 */
router.delete(
  '/content-types/:id/list-view/:slug',
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
        // Delete only rows matching this role
        await pool.query(
          `DELETE FROM entry_list_views
             WHERE content_type_id = $1
               AND slug = $2
               AND role = $3`,
          [contentTypeId, slug, roleParam]
        );
      } else {
        // Delete all rows for this slug (all roles)
        await pool.query(
          `DELETE FROM entry_list_views
             WHERE content_type_id = $1
               AND slug = $2`,
          [contentTypeId, slug]
        );
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('[DELETE /content-types/:id/list-view/:slug]', err);
      return res.status(500).json({ error: 'Failed to delete list view' });
    }
  }
);

export default router;
