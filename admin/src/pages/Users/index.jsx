import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'EDITOR',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // IMPORTANT: hit /api/users (not /users)
        const res = await api.get('/api/users');
        if (Array.isArray(res)) {
          setUsers(res);
        } else if (Array.isArray(res?.users)) {
          setUsers(res.users);
        } else if (Array.isArray(res?.data)) {
          setUsers(res.data);
        } else {
          setUsers([]);
        }
      } catch (err) {
        console.error('Failed to load users', err);
        setError('Failed to load users.');
      }
    })();
  }, []);

  function filteredUsers() {
    const needle = q.toLowerCase();
    return users.filter((u) =>
      (u.email || '').toLowerCase().includes(needle)
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
      const created = await api.post('/api/users', form);
      setUsers((prev) => [...prev, created]);
      setForm({ email: '', name: '', password: '', role: 'EDITOR' });
    } catch (err) {
      console.error('Failed to create user', err);
      setError(err.message || 'Failed to create user.');
    }
  }

  async function updateUser(id, patch) {
    try {
      const updated = await api.patch(`/api/users/${id}`, patch);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...updated } : u))
      );
    } catch (err) {
      console.error('Failed to update user', err);
      setError(err.message || 'Failed to update user.');
    }
  }

  async function removeUser(id) {
    if (!window.confirm('Remove this user?')) return;
    try {
      await api.del(`/api/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error('Failed to remove user', err);
      setError(err.message || 'Failed to remove user.');
    }
  }

  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <h2>New User</h2>
        <form onSubmit={createUser}>
          <label>
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
          <div style={{ height: 8 }} />
          <label>
            Name
            <input
              className="su-input"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </label>
          <div style={{ height: 8 }} />
          <label>
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
          <div style={{ height: 8 }} />
          <label>
            Role
            <select
              className="su-select"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value }))
              }
            >
              <option value="ADMIN">ADMIN</option>
              <option value="EDITOR">EDITOR</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </label>
          <div style={{ height: 12 }} />
          <button className="su-btn primary" type="submit">
            Create user
          </button>
          {error && (
            <div style={{ marginTop: 8, color: 'var(--su-danger)' }}>
              {error}
            </div>
          )}
        </form>
      </div>

      <div className="su-card">
        <h2>Users</h2>
        <div style={{ marginBottom: 8 }}>
          <input
            className="su-input"
            placeholder="Search by email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <table className="su-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers().map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  <input
                    className="su-input"
                    value={u.name || ''}
                    onChange={(e) =>
                      setUsers((prev) =>
                        prev.map((x) =>
                          x.id === u.id ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                    onBlur={(e) =>
                      updateUser(u.id, { name: e.target.value })
                    }
                  />
                </td>
                <td>
                  <select
                    className="su-select"
                    value={u.role || 'VIEWER'}
                    onChange={(e) =>
                      updateUser(u.id, { role: e.target.value })
                    }
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="EDITOR">EDITOR</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </td>
                <td>
                  <button
                    className="su-btn"
                    type="button"
                    onClick={() => removeUser(u.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers().length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '12px 0', opacity: 0.75 }}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
