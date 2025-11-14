import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function TaxonomiesPage() {
  const [tax, setTax] = useState([]);
  const [form, setForm] = useState({
    key: '',
    label: '',
    isHierarchical: false,
  });

  useEffect(() => {
    api
      .get('/api/taxonomies')
      .then((res) => {
        if (Array.isArray(res)) return setTax(res);
        if (Array.isArray(res?.taxonomies)) return setTax(res.taxonomies);
        if (Array.isArray(res?.data)) return setTax(res.data);
        setTax([]);
      })
      .catch(() => setTax([]));
  }, []);

  async function add() {
    const key = form.key.trim();
    const label = form.label.trim();
    if (!key || !label) return;

    const created = await api.post('/api/taxonomies', {
      key,
      label,
      isHierarchical: !!form.isHierarchical,
    });

    setTax((t) => [...t, created]);
    setForm({ key: '', label: '', isHierarchical: false });
  }

  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <h2>New Taxonomy</h2>
        <label>
          Key
          <input
            className="su-input"
            value={form.key}
            onChange={(e) =>
              setForm((f) => ({ ...f, key: e.target.value }))
            }
            placeholder="genre, topic, location…"
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Label
          <input
            className="su-input"
            value={form.label}
            onChange={(e) =>
              setForm((f) => ({ ...f, label: e.target.value }))
            }
            placeholder="Genre, Topic, Location…"
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          <input
            type="checkbox"
            checked={form.isHierarchical}
            onChange={(e) =>
              setForm((f) => ({ ...f, isHierarchical: e.target.checked }))
            }
          />{' '}
          Hierarchical (parent/child)
        </label>
        <div style={{ height: 12 }} />
        <button className="su-btn primary" onClick={add}>
          Add taxonomy
        </button>
      </div>

      <div className="su-card">
        <h2>Taxonomies</h2>
        <ul>
          {tax.map((t) => (
            <li
              key={t.id || t.key}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--su-border)',
              }}
            >
              <strong>{t.label || t.key}</strong>{' '}
              <span style={{ color: 'var(--su-muted)' }}>(/{t.key})</span>
            </li>
          ))}
          {tax.length === 0 && <li>No taxonomies yet.</li>}
        </ul>
      </div>
    </div>
  );
}
