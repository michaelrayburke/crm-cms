import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api
      // Backend route: /api/users
      .get('/api/users')
      .then((res) => {
        if (Array.isArray(res)) return setUsers(res);
        if (res && Array.isArray(res.users)) return setUsers(res.users);
        setUsers([]);
      })
      .catch(() => setUsers([]));
  }, []);

  function filtered() {
    const needle = q.toLowerCase();
    if (!needle) return users;
    return users.filter((u) => {
      return (
        (u.email || '').toLowerCase().includes(needle) ||
        (u.name || '').toLowerCase().includes(needle) ||
        (u.username || '').toLowerCase().includes(needle)
      );
    });
  }

  return (
    <div className="su-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>Users</h2>
        <input
          className="su-input"
          style={{ maxWidth: 260 }}
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <table className="su-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Email</th>
            <th align="left">Role</th>
          </tr>
        </thead>
        <tbody>
          {filtered().map((u) => (
            <tr key={u.id}>
              <td>{u.name || u.username || '(no name)'}</td>
              <td>{u.email}</td>
              <td>{u.role || '(none)'}</td>
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
