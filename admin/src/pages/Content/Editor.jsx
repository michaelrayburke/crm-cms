import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

/**
 * Minimal generic editor bound to entries.data.
 * - Uses /api/content/:slug and /api/content/:slug/:id
 * - Assumes backend returns { id, data, ... }
 */
export default function TypeEditor() {
  const navigate = useNavigate();
  const { typeSlug, id } = useParams();
  const isNew = id === 'new';
  const [dataState, setDataState] = useState({}); // maps to entries.data
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing entry (or initialize new)
  useEffect(() => {
    (async () => {
      if (isNew) {
        setDataState({ status: 'draft' });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        // ✅ GET /api/content/:slug/:id -> entry row
        const entry = await api.get(`/api/content/${typeSlug}/${id}`);
        setDataState(entry?.data || {});
      } catch (e) {
        console.error(e);
        setError('Unable to load entry.');
      } finally {
        setLoading(false);
      }
    })();
  }, [typeSlug, id, isNew]);

  const bind = (key) => (e) =>
    setDataState((prev) => ({ ...prev, [key]: e.target.value }));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload = { data: dataState };
      let saved;

      if (isNew) {
        // ✅ POST /api/content/:slug  { data: {...} }
        saved = await api.post(`/api/content/${typeSlug}`, payload);
      } else if (typeof api.put === 'function') {
        // ✅ PUT /api/content/:slug/:id  { data: {...} }
        saved = await api.put(`/api/content/${typeSlug}/${id}`, payload);
      } else {
        // fallback if api.put isn't defined
        saved = await api.post(`/api/content/${typeSlug}/${id}`, payload);
      }

      const newId = saved.id || saved._id || id;
      if (isNew && newId) {
        navigate(`/admin/content/${typeSlug}/${newId}`, { replace: true });
      } else {
        setDataState(saved.data || dataState);
      }
    } catch (e) {
      console.error(e);
      setError('Error saving entry.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (isNew) {
      navigate(`/admin/content/${typeSlug}`);
      return;
    }
    const confirmed = window.confirm('Delete this entry permanently?');
    if (!confirmed) return;

    try {
      // ✅ DELETE /api/content/:slug/:id
      if (typeof api.del === 'function') {
        await api.del(`/api/content/${typeSlug}/${id}`);
      } else if (typeof api.delete === 'function') {
        await api.delete(`/api/content/${typeSlug}/${id}`);
      } else {
        await api.post(`/api/content/${typeSlug}/${id}/delete`, {});
      }
      navigate(`/admin/content/${typeSlug}`);
    } catch (e) {
      console.error(e);
      setError('Error deleting entry.');
    }
  }

  if (loading) {
    return <div className="su-card">Loading entry…</div>;
  }

  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <h2>
          {isNew ? 'New' : 'Edit'} {typeSlug}
        </h2>

        {error && (
          <div className="su-alert su-error" style={{ marginBottom: 8 }}>
            {error}
          </div>
        )}

        <label>
          Title
          <input
            className="su-input"
            value={dataState.title || ''}
            onChange={bind('title')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Slug
          <input
            className="su-input"
            value={dataState.slug || ''}
            onChange={bind('slug')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Status
          <select
            className="su-select"
            value={dataState.status || 'draft'}
            onChange={bind('status')}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <div style={{ height: 12 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="su-btn primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="su-btn" onClick={() => navigate(-1)}>
            Back
          </button>
          {!isNew && (
            <button
              className="su-btn danger"
              onClick={remove}
              type="button"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="su-card">
        <h3>Preview (entries.data)</h3>
        <pre
          style={{
            maxHeight: 300,
            overflow: 'auto',
            fontSize: 12,
            background: 'var(--su-surface-subtle)',
            padding: 8,
          }}
        >
          {JSON.stringify(dataState, null, 2)}
        </pre>
        <div style={{ opacity: 0.7, marginTop: 8 }}>
          Later we’ll swap this out with the full Quick Builder fields + rich
          preview, but everything here already maps 1:1 to entries.data.
        </div>
      </div>
    </div>
  );
}
