// admin/src/pages/Settings/Permissions.jsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePerms, setRolePerms] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/api/permissions');
        setRoles(res.roles || []);
        setPermissions(res.permissions || []);
        setRolePerms(res.role_permissions || []);
      } catch (err) {
        console.error('Failed to load permissions', err);
        setError(err.message || 'Failed to load permissions');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // TODO: build the matrix UI – for now just dump JSON
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Permissions</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <pre className="text-xs bg-gray-900 text-green-100 rounded-lg p-3 overflow-auto">
          {JSON.stringify({ roles, permissions, rolePerms }, null, 2)}
        </pre>
      )}
    </div>
  );
}