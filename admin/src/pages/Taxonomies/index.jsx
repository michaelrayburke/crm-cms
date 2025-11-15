import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function TaxonomiesPage() {
  const [taxonomies, setTaxonomies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    key: '',
    label: '',
    isHierarchical: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/taxonomies');
        if (Array.isArray(res)) {
          setTaxonomies(res);
        } else if (Array.isArray(res?.taxonomies)) {
          setTaxonomies(res.taxonomies);
        } else if (Array.isArray(res?.data)) {
          setTaxonomies(res.data);
        } else {
          setTaxonomies([]);
        }
      } catch (err) {
        console.error('Failed to load taxonomies', err);
        setError('Could not load taxonomies.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!form.key.trim() || !form.label.trim()) {
      setError('Key and label are required.');
      return;
    }

    try {
      const created = await api.post('/api/taxonomies', form);
      setTaxonomies((prev) => [...prev, created]);
      setForm({ key: '', label: '', isHierarchical: false });
    } catch (err) {
      console.error('Failed to create taxonomy', err);
      setError(err.message || 'Failed to create taxonomy.');
    }
  }

  if (loading) {
    return <div className="su-card">Loading taxonomies…</div>;
  }

  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <h2>New Taxonomy</h2>
        <form onSubmit={handleCreate}>
          <label>
            Key
            <input
              className="su-input"
              value={form.key}
              onChange={(e) =>
                setForm((f) => ({ ...f, key: e.target.value }))
              }
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
            />
          </label>
          <div style={{ height: 8 }} />
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <input
              type="checkbox"
              checked={form.isHierarchical}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  isHierarchical: e.target.checked,
                }))
              }
            />
            Hierarchical
          </label>
          <div style={{ height: 12 }} />
          <button className="su-btn primary" type="submit">
            Add taxonomy
          </button>
          {error && (
            <div style={{ marginTop: 8, color: 'var(--su-danger)' }}>
              {error}
            </div>
          )}
        </form>
      </div>

      <div className="su-card">
        <h2>Existing Taxonomies</h2>
        {taxonomies.length === 0 && (
          <div style={{ opacity: 0.75 }}>No taxonomies yet.</div>
        )}
        <ul>
          {taxonomies.map((t) => (
            <li
              key={t.id || t.key}
              style={{
                padding: '6px 0',
                borderBottom: '1px solid var(--su-border)',
              }}
            >
              <strong>{t.label || t.key}</strong>{' '}
              <span style={{ opacity: 0.7 }}>/ {t.key}</span>{' '}
              {t.is_hierarchical && (
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  (hierarchical)
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
