// admin/src/pages/Users/index.jsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'EDITOR',
    status: 'ACTIVE',
  });

  // Load users
  async function loadUsers(search = '') {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/users${search ? `?q=${encodeURIComponent(search)}` : ''}`);
      setUsers(data || []);
    } catch (err) {
      console.error('[Users] load error', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function startCreate() {
    setCreating(true);
    setEditingUser(null);
    setForm({
      email: '',
      name: '',
      password: '',
      role: 'EDITOR',
      status: 'ACTIVE',
    });
  }

  function startEdit(user) {
    setEditingUser(user);
    setCreating(false);
    setForm({
      email: user.email || '',
      name: user.name || '',
      password: '',
      role: user.role || 'EDITOR',
      status: user.status || 'ACTIVE',
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingUser) {
        const payload = {
          email: form.email,
          name: form.name,
          role: form.role,
          status: form.status,
        };
        if (form.password && form.password.trim()) {
          payload.password = form.password.trim();
        }
        await api.patch(`/users/${editingUser.id}`, payload);
      } else {
        await api.post('/users', {
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
        });
      }
      await loadUsers(q);
      setEditingUser(null);
      setCreating(false);
      setForm({
        email: '',
        name: '',
        password: '',
        role: 'EDITOR',
        status: 'ACTIVE',
      });
    } catch (err) {
      console.error('[Users] save error', err);
      setError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Delete user ${user.email}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await api.del(`/users/${user.id}`);
      await loadUsers(q);
      if (editingUser && editingUser.id === user.id) {
        setEditingUser(null);
        setCreating(false);
      }
    } catch (err) {
      console.error('[Users] delete error', err);
      setError(err.message || 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  }

  async function handleSearchSubmit(e) {
    e.preventDefault();
    await loadUsers(q);
  }

  return (
    <div className="su-page su-page--users">
      <div className="su-page-header">
        <div>
          <h1 className="su-page-title">Users</h1>
          <p className="su-page-subtitle">
            Manage admin accounts and roles.
          </p>
        </div>
        <button
          type="button"
          className="su-btn su-btn--primary"
          onClick={startCreate}
        >
          + New user
        </button>
      </div>

      <div className="su-page-toolbar">
        <form onSubmit={handleSearchSubmit} className="su-inline-form">
          <input
            type="text"
            className="su-input"
            placeholder="Search by email or name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <button type="submit" className="su-btn su-btn--ghost">
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="su-alert su-alert--error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="su-loading">Loading users…</div>
      ) : (
        <div className="su-layout su-layout--two">
          <div className="su-card">
            <table className="su-table su-table--compact">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ width: '1%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.name || '—'}</td>
                    <td>{user.role}</td>
                    <td>{user.status}</td>
                    <td>
                      <div className="su-btn-group su-btn-group--compact">
                        <button
                          type="button"
                          className="su-btn su-btn--xs su-btn--ghost"
                          onClick={() => startEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="su-btn su-btn--xs su-btn--danger-ghost"
                          onClick={() => handleDelete(user)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="su-card">
            {(creating || editingUser) ? (
              <>
                <h2 className="su-card-title">
                  {editingUser ? `Edit ${editingUser.email}` : 'Create user'}
                </h2>
                <form onSubmit={handleSave} className="su-form">
                  <label className="su-field">
                    <span>Email</span>
                    <input
                      type="email"
                      className="su-input"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="su-field">
                    <span>Name</span>
                    <input
                      type="text"
                      className="su-input"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </label>
                  <label className="su-field">
                    <span>
                      Password {editingUser && <small>(leave blank to keep)</small>}
                    </span>
                    <input
                      type="password"
                      className="su-input"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      {...(!editingUser ? { required: true } : {})}
                    />
                  </label>
                  <label className="su-field">
                    <span>Role</span>
                    <select
                      className="su-input"
                      value={form.role}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="EDITOR">EDITOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </label>
                  {editingUser && (
                    <label className="su-field">
                      <span>Status</span>
                      <select
                        className="su-input"
                        value={form.status}
                        onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="DISABLED">DISABLED</option>
                      </select>
                    </label>
                  )}

                  <div className="su-form-actions">
                    <button
                      type="button"
                      className="su-btn su-btn--ghost"
                      onClick={() => {
                        setCreating(false);
                        setEditingUser(null);
                        setForm({
                          email: '',
                          name: '',
                          password: '',
                          role: 'EDITOR',
                          status: 'ACTIVE',
                        });
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="su-btn su-btn--primary"
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save user'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="su-empty-side">
                <p>Select a user to edit, or click “New user” to create one.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
