// api/routes/editorViews.js
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

async function getEditorViewsForTypeAndRole(contentTypeId, role) {
  // Fetch all editor views for a content type.  We no longer filter by
  // role in the query, because a single view may be shared across roles.
  const { rows } = await pool.query(
    `
      SELECT id, content_type_id, slug, label, role, is_default, config
      FROM entry_editor_views
      WHERE content_type_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [contentTypeId]
  );
  const roleValue = (role || 'ADMIN').toUpperCase();
  return rows.filter((row) => {
    const cfg = row.config || {};
    const roles = Array.isArray(cfg.roles)
      ? cfg.roles.map((r) => String(r || '').toUpperCase())
      : row.role
      ? [String(row.role || '').toUpperCase()]
      : [];
    if (roles.length === 0) return true;
    return roles.includes(roleValue);
  });
}

async function getDefaultEditorView(contentTypeId, role) {
  // Determine the best editor view for the given type and role.  A view is
  // considered default for a role if the role appears in config.default_roles.
  const roleValue = (role || 'ADMIN').toUpperCase();
  const { rows } = await pool.query(
    `SELECT id, content_type_id, slug, label, role, is_default, config
       FROM entry_editor_views
      WHERE content_type_id = $1
      ORDER BY created_at ASC, id ASC`,
    [contentTypeId]
  );
  // Filter to views accessible to the role
  const accessible = rows.filter((row) => {
    const cfg = row.config || {};
    const roles = Array.isArray(cfg.roles)
      ? cfg.roles.map((r) => String(r || '').toUpperCase())
      : row.role
      ? [String(row.role || '').toUpperCase()]
      : [];
    if (roles.length === 0) return true;
    return roles.includes(roleValue);
  });
  // Among accessible views, find those where the role is in default_roles.
  const defaultViews = accessible.filter((row) => {
    const cfg = row.config || {};
    const defaults = Array.isArray(cfg.default_roles)
      ? cfg.default_roles.map((r) => String(r || '').toUpperCase())
      : row.is_default && row.role
      ? [String(row.role || '').toUpperCase()]
      : [];
    return defaults.includes(roleValue);
  });
  if (defaultViews.length > 0) {
    // Return the first default view for this role
    return defaultViews[0];
  }
  // Otherwise return the first accessible view
  return accessible[0] || null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/content-types/:id/editor-views?role=ADMIN
 * Return all editor views for a given type + role.
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 * IMPORTANT: returns a plain array for backwards compatibility.
 */
router.get(
  '/content-types/:id/editor-views',
  checkPermission('manage_content_types'),
  async (req, res) => {
    try {
      const { id: idOrSlug } = req.params;
      const role = (req.query.role || req.user?.role || 'ADMIN').toUpperCase();

      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      const views = await getEditorViewsForTypeAndRole(contentTypeId, role);

      // NOTE: returning the raw array keeps existing frontend logic working.
      return res.json(views);
    } catch (err) {
      console.error('[GET /content-types/:id/editor-views]', err);
      return res.status(500).json({ error: 'Failed to load editor views' });
    }
  }
);

/**
 * GET /api/content-types/:id/editor-view?role=ADMIN
 * Return the default (or first) editor view config for a given type + role.
 *
 * Used by the entry editor when no explicit view has been chosen.
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 */
router.get(
  '/content-types/:id/editor-view',
  checkPermission('manage_content_types'),
  async (req, res) => {
    try {
      const { id: idOrSlug } = req.params;
      const role = (req.query.role || req.user?.role || 'ADMIN').toUpperCase();

      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }

      const view = await getDefaultEditorView(contentTypeId, role);

      if (!view) {
        // No views configured yet: caller should fall back to auto-layout.
        return res.json({ config: {}, view: null });
      }

      return res.json({
        config: view.config || {},
        view,
      });
    } catch (err) {
      console.error('[GET /content-types/:id/editor-view]', err);
      return res.status(500).json({ error: 'Failed to load editor view' });
    }
  }
);

/**
 * PUT /api/content-types/:id/editor-view
 * Create or update a single editor view definition for a type + role.
 *
 * Body:
 *   {
 *     slug: string,
 *     label: string,
 *     role: "ADMIN" | "EDITOR" | "...",
 *     is_default: boolean,
 *     config: { sections: [...] }
 *   }
 *
 * NOTE: :id may be either the UUID primary key or the content type slug.
 */
router.put(
  '/content-types/:id/editor-view',
  checkPermission('manage_content_types'),
  async (req, res) => {
    // Accept multiple roles and default roles when creating or updating an editor
    // view.  We upsert a view row per role to maintain the existing
    // table structure while allowing a single logical view to be shared.
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
      // Normalize roles array
      let roleList;
      if (Array.isArray(roles) && roles.length > 0) {
        roleList = roles;
      } else if (typeof role === 'string' && role.trim()) {
        roleList = [role];
      } else {
        const fallbackRole = req.user?.role || 'ADMIN';
        roleList = [fallbackRole];
      }
      roleList = roleList.map((r) => String(r || '').toUpperCase());
      // Normalize default roles
      let defaultRoleList;
      if (Array.isArray(default_roles)) {
        defaultRoleList = default_roles.map((r) => String(r || '').toUpperCase());
      } else if (typeof isDefault === 'boolean' && isDefault === true) {
        defaultRoleList = [...roleList];
      } else {
        defaultRoleList = [];
      }
      const contentTypeId = await resolveContentTypeId(idOrSlug);
      if (!contentTypeId) {
        return res.status(404).json({ error: 'Content type not found' });
      }
      await client.query('BEGIN');
      const upsertResults = [];
      for (const roleValueRaw of roleList) {
        const roleValue = roleValueRaw.toUpperCase();
        const isDefaultForRole = defaultRoleList.includes(roleValue);
        if (isDefaultForRole) {
          await client.query(
            `UPDATE entry_editor_views
               SET is_default = FALSE
             WHERE content_type_id = $1
               AND role = $2`,
            [contentTypeId, roleValue]
          );
        }
        const { rows: existingRows } = await client.query(
          `SELECT id
             FROM entry_editor_views
            WHERE content_type_id = $1
              AND slug = $2
              AND role = $3
            LIMIT 1`,
          [contentTypeId, slug, roleValue]
        );
        let savedRow;
        if (existingRows.length > 0) {
          const { rows: updateRows } = await client.query(
            `UPDATE entry_editor_views
                SET label = $1,
                    is_default = $2,
                    config = $3,
                    updated_at = NOW()
              WHERE id = $4
              RETURNING id, content_type_id, slug, label, role, is_default, config`,
            [
              label || slug,
              isDefaultForRole,
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
          const { rows: insertRows } = await client.query(
            `INSERT INTO entry_editor_views
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
      return res.json({ views: upsertResults });
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
