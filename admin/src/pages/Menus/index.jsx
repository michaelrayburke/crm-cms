import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function MenusPage() {
  const [items, setItems] = useState([]);
  const [label, setLabel] = useState('');

  useEffect(() => {
    api
      .get('/menus')
      .then((res) => setItems(Array.isArray(res) ? res : res?.data || []))
      .catch(() => setItems([]));
  }, []);

  async function add() {
    if (!label.trim()) return;
    const created = await api.post('/menus', { label });
    setItems((i) => [...i, created]);
    setLabel('');
  }

  return (
    <div className="su-grid">
      <div className="su-card">
        <h2>Menus</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="su-input"
            placeholder="Label…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button className="su-btn primary" onClick={add}>
            Add
          </button>
        </div>
      </div>
      <div className="su-card">
        <ul>
          {items.map((it) => (
            <li
              key={it.id}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--su-border)',
              }}
            >
              {it.label}
            </li>
          ))}
          {items.length === 0 && <li>No menus yet.</li>}
        </ul>
      </div>
    </div>
  );
}
