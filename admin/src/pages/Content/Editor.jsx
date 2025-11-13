import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

/**
 * Minimal generic editor.
 * Later we can swap the simple fields for your full Quick Builder fields.
 */
export default function TypeEditor() {
  const navigate = useNavigate();
  const { typeSlug, id } = useParams();
  const isNew = id === 'new';
  const [doc, setDoc] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing doc (or initialize new)
  useEffect(() => {
    (async () => {
      if (isNew) {
        setDoc({ status: 'draft' });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/content/${typeSlug}/${id}`);
        setDoc(res || {});
      } catch (e) {
        console.error(e);
        setError('Unable to load entry.');
      } finally {
        setLoading(false);
      }
    })();
  }, [typeSlug, id, isNew]);

  const bind = (key) => (e) =>
    setDoc((prev) => ({ ...prev, [key]: e.target.value }));

  async function save() {
    setSaving(true);
    setError('');
    try {
      let saved;
      if (isNew) {
        saved = await api.post(`/content/${typeSlug}`, doc);
      } else if (typeof api.put === 'function') {
        saved = await api.put(`/content/${typeSlug}/${id}`, doc);
      } else {
        // Fallback: some older helpers only have .post
        saved = await api.post(`/content/${typeSlug}/${id}`, doc);
      }

      const newId = saved.id || saved._id || id;
      if (isNew && newId) {
        navigate(`/admin/content/${typeSlug}/${newId}`, { replace: true });
      } else {
        setDoc(saved);
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
      await api.delete(`/content/${typeSlug}/${id}`);
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
            value={doc.title || ''}
            onChange={bind('title')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Slug
          <input
            className="su-input"
            value={doc.slug || ''}
            onChange={bind('slug')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Status
          <select
            className="su-select"
            value={doc.status || 'draft'}
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
          <button
            className="su-btn danger"
            onClick={remove}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="su-card">
        <h3>Preview (JSON)</h3>
        <pre
          style={{
            maxHeight: 300,
            overflow: 'auto',
            fontSize: 12,
            background: 'var(--su-surface-subtle)',
            padding: 8,
          }}
        >
          {JSON.stringify(doc, null, 2)}
        </pre>
        <div style={{ opacity: 0.7, marginTop: 8 }}>
          Later we’ll swap this out with the full Quick Builder fields + rich
          preview.
        </div>
      </div>
    </div>
  );
}
