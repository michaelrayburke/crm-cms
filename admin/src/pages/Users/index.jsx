// admin/src/pages/Users/index.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'EDITOR',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ✅ NEW: inline name editing state
  const [nameDraftById, setNameDraftById] = useState({});
  const [nameSavingById, setNameSavingById] = useState({});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [usersRes, rolesRes] = await Promise.all([
          api.get('/api/users'),
          api.get('/api/roles'),
        ]);
        setUsers(usersRes || []);
        setRoles(rolesRes || []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load users/roles');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function filteredUsers() {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.name && u.name.toLowerCase().includes(term))
    );
  }

  async function createUser(e) {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password.trim()) {
      setError('Email and password are required.');
      return;
    }
    try {
      setSaving(true);
      const created = await api.post('/api/users', {
        email: form.email.trim(),
        name: form.name.trim() || null,
        password: form.password,
        role: form.role,
      });
      setUsers((prev) => [created, ...prev]);
      setForm({
        email: '',
        name: '',
        password: '',
        role: form.role, // keep same role selected
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id, patch) {
    setError('');
    try {
      const updated = await api.patch(`/api/users/${id}`, patch);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      return updated;
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update user');
      throw err;
    }
  }

  async function deleteUser(id) {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) {
      return;
    }
    setError('');
    try {
      await api.del(`/api/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setNameDraftById((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
      setNameSavingById((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete user');
    }
  }

  // ✅ NEW: inline name editing helpers
  const getNameDraft = (u) => {
    const v = nameDraftById[u.id];
    if (v === undefined) return u.name || '';
    return v;
  };

  const isNameDirty = (u) => {
    const draft = getNameDraft(u);
    return (draft || '') !== (u.name || '');
  };

  const setDraft = (id, val) => {
    setNameDraftById((m) => ({ ...m, [id]: val }));
  };

  const cancelNameEdit = (u) => {
    setNameDraftById((m) => ({ ...m, [u.id]: u.name || '' }));
  };

  const saveName = async (u) => {
    const draft = getNameDraft(u).trim();
    const nextName = draft.length ? draft : null;

    // no-op if unchanged
    if ((u.name || '') === (nextName || '')) return;

    setNameSavingById((m) => ({ ...m, [u.id]: true }));
    try {
      const updated = await updateUser(u.id, { name: nextName });
      // sync draft to saved value
      setNameDraftById((m) => ({ ...m, [u.id]: updated?.name || '' }));
    } finally {
      setNameSavingById((m) => ({ ...m, [u.id]: false }));
    }
  };

  const usersToRender = useMemo(() => filteredUsers(), [users, q]); // eslint-disable-line

  return (
    <div className="su-page su-page--users">
      {/* Header */}
      <div className="su-page__header">
        <div>
          <h1 className="su-page__title">Users</h1>
          <p className="su-page__subtitle">
            Manage admin users and their roles. Roles map to the values you define in
            the Roles Manager and are synced into Supabase Auth.
          </p>
        </div>
      </div>

      {/* Error notice */}
      {error && (
        <div
          className="su-card"
          style={{ borderColor: '#fecaca', background: '#fef2f2', marginBottom: 16 }}
        >
          <div style={{ color: '#991b1b', fontSize: 13 }}>{error}</div>
        </div>
      )}

      {/* Content */}
      <div className="su-page__content su-grid cols-2">
        {/* New User form */}
        <div className="su-card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>New User</h2>
          <form onSubmit={createUser}>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 13 }}>
                Email
                <input
                  className="su-input"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Name
                <input
                  className="su-input"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Password
                <input
                  className="su-input"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Role
                <select
                  className="su-select"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value }))
                  }
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.label} ({r.slug})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ height: 12 }} />
            <button
              className="su-btn primary"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create user'}
            </button>
          </form>
        </div>

        {/* Users list */}
        <div className="su-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <h2 style={{ margin: 0 }}>Users</h2>
            <input
              className="su-input"
              placeholder="Search by email or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 260 }}
            />
          </div>

          {loading ? (
            <p style={{ fontSize: 13, opacity: 0.75 }}>Loading users…</p>
          ) : (
            <table className="su-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th style={{ width: 140 }}>Role</th>
                  <th style={{ width: 160 }} />
                </tr>
              </thead>
              <tbody>
                {usersToRender.map((u) => {
                  const nameDraft = getNameDraft(u);
                  const dirty = isNameDirty(u);
                  const nameSaving = !!nameSavingById[u.id];

                  return (
                    <tr key={u.id}>
                      <td>{u.email}</td>

                      {/* ✅ Editable Name column */}
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="su-input"
                            value={nameDraft}
                            placeholder="(no name)"
                            onChange={(e) => setDraft(u.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveName(u);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelNameEdit(u);
                              }
                            }}
                            style={{ minWidth: 180 }}
                          />

                          <button
                            type="button"
                            className="su-btn primary"
                            disabled={!dirty || nameSaving}
                            onClick={() => saveName(u)}
                            style={{ fontSize: 12, padding: '6px 10px' }}
                          >
                            {nameSaving ? 'Saving…' : 'Save'}
                          </button>

                          {dirty && !nameSaving && (
                            <button
                              type="button"
                              className="su-btn"
                              onClick={() => cancelNameEdit(u)}
                              style={{ fontSize: 12, padding: '6px 10px' }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>

                      <td>
                        <select
                          className="su-select"
                          value={u.role || 'VIEWER'}
                          onChange={(e) =>
                            updateUser(u.id, { role: e.target.value })
                          }
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.slug}>
                              {r.label} ({r.slug})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="su-btn"
                          style={{
                            fontSize: 12,
                            borderColor: '#fecaca',
                            background: '#fef2f2',
                            color: '#b91c1c',
                          }}
                          onClick={() => deleteUser(u.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {usersToRender.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} style={{ padding: '12px 0', opacity: 0.75 }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
