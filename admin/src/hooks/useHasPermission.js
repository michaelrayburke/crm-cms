// admin/src/hooks/useHasPermission.js
import { useAuth } from '../context/AuthContext';

export default function useHasPermission(slug) {
  const { user, permissions, loadingPermissions } = useAuth();

  // If no permission specified, always allow
  if (!slug) return true;

  // Not logged in -> no permissions
  if (!user) return false;

  const role = user.role ? String(user.role).toUpperCase() : null;

  // ADMIN is superuser on the frontend too
  if (role === 'ADMIN') return true;

  // If permissions are still loading, you can either:
  // - return false to be safe (current behavior)
  // - or return true to avoid brief flashes.
  // We'll be strict for now:
  if (loadingPermissions) return false;

  const list = Array.isArray(permissions) ? permissions : [];

  // Simple check: does this role have this permission?
  return list.some((p) => p.slug === slug && p.allowed !== false);
}
