// admin/src/pages/Settings/Roles.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    slug: '',
    label: '',
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await api.get('/api/roles');
        setRoles(data || []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load roles');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function createRole(e) {
    e.preventDefault();
    setError('');
    if (!form.slug.trim() || !form.label.trim()) {
      setError('Slug and label are required');
      return;
    }
    try {
      setSaving(true);
      const created = await api.post('/api/roles', {
        slug: form.slug.trim().toUpperCase(),
        label: form.label.trim(),
      });
      setRoles((prev) => [...prev, created]);
      setForm({ slug: '', label: '' });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(id, patch) {
    setError('');
    try {
      const updated = await api.patch(`/api/roles/${id}`, patch);
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update role');
    }
  }

  async function deleteRole(id) {
    setError('');
    const role = roles.find((r) => r.id === id);
    if (!role) return;
    if (!window.confirm(`Delete role "${role.label}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.del(`/api/roles/${id}`);
      setRoles((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete role');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Roles</h1>
        <p className="text-sm text-gray-600">
          Define which admin roles exist (ADMIN, EDITOR, VIEWER, SHOP_MANAGER, etc.).
          Roles are used for navigation, admin views, and are synced into Supabase Auth
          as <code>user_metadata.role</code>.
        </p>
      </div>

      {error && (
        <div className="su-card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ color: '#991b1b', fontSize: 13 }}>{error}</div>
        </div>
      )}

      <div className="su-grid cols-2">
        {/* Left: Create role */}
        <div className="su-card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>New Role</h2>
          <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
            Slug is the internal value (e.g. <code>SHOP_MANAGER</code>), label is what you see in
            dropdowns.
          </p>
          <form onSubmit={createRole}>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <label style={{ fontSize: 13 }}>
                Slug
                <input
                  className="su-input"
                  placeholder="SHOP_MANAGER"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Label
                <input
                  className="su-input"
                  placeholder="Shop Manager"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </label>
            </div>
            <button className="su-btn primary" type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create role'}
            </button>
          </form>
        </div>

        {/* Right: Roles list */}
        <div className="su-card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Existing Roles</h2>
          {loading ? (
            <p style={{ fontSize: 13, opacity: 0.75 }}>Loading roles…</p>
          ) : roles.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.75 }}>No roles yet.</p>
          ) : (
            <table className="su-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Slug</th>
                  <th style={{ width: '40%' }}>Label</th>
                  <th style={{ width: '10%' }}>System</th>
                  <th style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <input
                        className="su-input"
                        style={{ fontSize: 12 }}
                        value={role.slug}
                        disabled={role.is_system}
                        onChange={(e) =>
                          updateRole(role.id, { slug: e.target.value.toUpperCase() })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="su-input"
                        style={{ fontSize: 12 }}
                        value={role.label}
                        onChange={(e) =>
                          updateRole(role.id, { label: e.target.value })
                        }
                      />
                    </td>
                    <td style={{ fontSize: 12, textAlign: 'center' }}>
                      {role.is_system ? 'Yes' : 'No'}
                    </td>
                    <td>
                      {!role.is_system && (
                        <button
                          type="button"
                          className="su-btn"
                          style={{
                            fontSize: 12,
                            borderColor: '#fecaca',
                            background: '#fef2f2',
                            color: '#b91c1c',
                          }}
                          onClick={() => deleteRole(role.id)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
