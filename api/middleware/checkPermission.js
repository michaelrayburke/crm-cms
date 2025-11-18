// api/middleware/checkPermission.js
import { pool } from '../dbPool.js';

/**
 * Simple cache in memory so we don’t hit DB on every request.
 * You can clear this on redeploy; it’s fine.
 */
const rolePermCache = new Map();
let lastCacheLoad = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

async function loadPermissionsIntoCache() {
  const now = Date.now();
  if (now - lastCacheLoad < CACHE_TTL_MS) return;

  const { rows } = await pool.query(
    'select role_slug, permission_slug, allowed from public.role_permissions'
  );
  const map = new Map();

  for (const row of rows) {
    const key = `${row.role_slug}:${row.permission_slug}`;
    map.set(key, row.allowed === true);
  }

  rolePermCache.clear();
  for (const [k, v] of map.entries()) {
    rolePermCache.set(k, v);
  }
  lastCacheLoad = now;
}

export function checkPermission(permissionSlug) {
  return async function (req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const role = user.role || 'VIEWER';

      await loadPermissionsIntoCache();

      const key = `${role}:${permissionSlug}`;
      const allowed = rolePermCache.get(key);

      if (!allowed) {
        return res
          .status(403)
          .json({ error: `Forbidden: missing permission ${permissionSlug}` });
      }

      next();
    } catch (err) {
      console.error('[checkPermission]', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

// Optional helper: require ANY of several permissions
export function checkAnyPermission(permissionSlugs = []) {
  return async function (req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const role = user.role || 'VIEWER';

      await loadPermissionsIntoCache();

      const ok = permissionSlugs.some((slug) => {
        const key = `${role}:${slug}`;
        return rolePermCache.get(key) === true;
      });

      if (!ok) {
        return res.status(403).json({
          error: `Forbidden: requires one of [${permissionSlugs.join(', ')}]`,
        });
      }

      next();
    } catch (err) {
      console.error('[checkAnyPermission]', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}
