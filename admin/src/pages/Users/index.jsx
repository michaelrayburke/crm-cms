import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api
      .get('/users')
      .then((res) => setUsers(Array.isArray(res) ? res : res?.data || []))
      .catch(() => setUsers([]));
  }, []);

  function filtered() {
    const needle = q.toLowerCase();
    return users.filter((u) =>
      (u.email || '').toLowerCase().includes(needle)
    );
  }

  async function setRole(id, role) {
    if (typeof api.patch === 'function') {
      await api.patch(`/users/${id}`, { role });
    } else {
      // Fallback to POST if patch isn't supported in the helper
      await api.post(`/users/${id}`, { role });
    }

    setUsers((uu) =>
      uu.map((u) => (u.id === id ? { ...u, role } : u)),
    );
  }

  return (
    <div className="su-card">
      <h2>Users</h2>
      <input
        className="su-input"
        placeholder="Search by email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <table className="su-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">Email</th>
            <th align="left">Name</th>
            <th align="left">Role</th>
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
            </tr>
          ))}
          {filtered().length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: '12px 0', opacity: 0.7 }}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
