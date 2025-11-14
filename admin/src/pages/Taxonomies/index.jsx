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
      // Backend route: /api/taxonomies -> { ok, taxonomies }
      .get('/api/taxonomies')
      .then((res) => {
        if (Array.isArray(res)) return setTax(res);
        if (res && Array.isArray(res.taxonomies)) return setTax(res.taxonomies);
        setTax([]);
      })
      .catch(() => setTax([]));
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.key.trim() || !form.label.trim()) return;

    // NOTE: At the moment backend only exposes GET /api/taxonomies.
    // Once a POST route exists, we can wire it here. For now this is a no-op.
    try {
      const created = await api.post('/api/taxonomies', form);
      // try to be defensive about shape
      if (created) {
        setTax((t) => [...t, created]);
      }
      setForm({ key: '', label: '', isHierarchical: false });
    } catch (err) {
      console.error('Failed to create taxonomy (API route may not exist yet)', err);
    }
  }

  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <h2>New Taxonomy</h2>
        <form onSubmit={add}>
          <label>
            Key
            <input
              className="su-input"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            />
          </label>
          <div style={{ height: 8 }} />
          <label>
            Label
            <input
              className="su-input"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </label>
          <div style={{ height: 8 }} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.isHierarchical}
              onChange={(e) =>
                setForm((f) => ({ ...f, isHierarchical: e.target.checked }))
              }
            />
            <span>Hierarchical (like categories)</span>
          </label>
          <div style={{ height: 12 }} />
          <button className="su-btn primary" type="submit">
            Add taxonomy
          </button>
        </form>
      </div>

      <div className="su-card">
        <h2>Existing Taxonomies</h2>
        <table className="su-table">
          <thead>
            <tr>
              <th align="left">Key</th>
              <th align="left">Label</th>
              <th align="left">Hierarchical</th>
            </tr>
          </thead>
          <tbody>
            {tax.map((t) => (
              <tr key={t.id || t.key}>
                <td>{t.key}</td>
                <td>{t.label || t.name}</td>
                <td>{t.is_hierarchical ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {tax.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '12px 0', opacity: 0.7 }}>
                  No taxonomies yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
