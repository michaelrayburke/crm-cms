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

  useEffect(() => {
    api
      .get('/users')
      .then((res) => {
        if (Array.isArray(res)) {
          setUsers(res);
        } else if (Array.isArray(res?.users)) {
          setUsers(res.users);
        } else if (Array.isArray(res?.data)) {
          setUsers(res.data);
        } else {
          setUsers([]);
        }
      })
      .catch(() => setUsers([]));
  }, []);

  function filtered() {
    const needle = q.toLowerCase();
    return users.filter((u) => (u.email || '').toLowerCase().includes(needle));
  }

  async function setRole(id, role) {
    if (typeof api.patch === 'function') {
      await api.patch(`/users/${id}`, { role });
    } else {
      await api.post(`/users/${id}`, { role });
    }

    setUsers((uu) => uu.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  async function createUser(e) {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) return;
    const created = await api.post('/users', form);
    setUsers((uu) => [...uu, created]);
    setForm({ email: '', name: '', password: '', role: 'EDITOR' });
  }

  async function removeUser(id) {
    if (!window.confirm('Remove this user?')) return;
    await api.del(`/users/${id}`);
    setUsers((uu) => uu.filter((u) => u.id !== id));
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
            {filtered().map((u) => (
              <tr
                key={u.id}
                style={{ borderTop: '1px solid var(--su-border)' }}
              >
                <td>{u.email}</td>
                <td>{u.name || '-'}</td>
                <td>
                  <select
                    className="su-select"
                    value={u.role || 'VIEWER'}
                    onChange={(e) => setRole(u.id, e.target.value)}
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
            {filtered().length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '12px 0', opacity: 0.7 }}>
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
