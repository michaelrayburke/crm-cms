import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

function slugify(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function Editor() {
  const { typeSlug, entryId } = useParams();
  const navigate = useNavigate();

  const isNew = !entryId || entryId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('draft');

  // everything that lives in entries.data
  const [data, setData] = useState({});

  // helper state for adding new custom fields
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  // ---------------------------------------------------------------------------
  // Load existing entry (edit mode only)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isNew) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      setSaveMessage('');
      try {
        const res = await api.get(`/api/content/${typeSlug}/${entryId}`);
        if (res && res.ok === false) {
          throw new Error(res.error || res.detail || 'Failed to load entry');
        }
        const entry = res.entry || res.data || res;
        if (cancelled) return;

        const entryData = entry.data || {};

        // Prefer top-level fields, but gracefully fall back to data.*
        const loadedTitle =
          entry.title ??
          entryData.title ??
          entryData._title ??
          '';
        const loadedSlug =
          entry.slug ??
          entryData.slug ??
          entryData._slug ??
          '';
        const loadedStatus =
          entry.status ??
          entryData.status ??
          entryData._status ??
          'draft';

        setTitle(loadedTitle);
        setSlug(loadedSlug);
        setStatus(loadedStatus);
        setData(entryData);
      } catch (err) {
        console.error('Failed to load entry', err);
        if (!cancelled) {
          setError(err.message || 'Failed to load entry');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isNew, typeSlug, entryId]);

  // ---------------------------------------------------------------------------
  // Custom fields
  // ---------------------------------------------------------------------------

  const customFieldEntries = useMemo(
    () => Object.entries(data || {}),
    [data]
  );

  function updateCustomField(key, rawValue) {
    setData(prev => {
      const next = { ...(prev || {}) };
      const current = next[key];

      // If current value is a simple primitive, keep as simple string.
      if (
        typeof current === 'string' ||
        typeof current === 'number' ||
        typeof current === 'boolean' ||
        current === null ||
        typeof current === 'undefined'
      ) {
        next[key] = rawValue;
        return next;
      }

      // For non-string values, try to parse JSON so we can handle arrays/objects/bools/numbers.
      try {
        if (rawValue === '') {
          next[key] = null;
        } else {
          next[key] = JSON.parse(rawValue);
        }
      } catch {
        // Fallback: store raw string if JSON parse fails
        next[key] = rawValue;
      }
      return next;
    });
  }

  function handleAddField(e) {
    e.preventDefault();
    const key = newFieldKey.trim();
    if (!key) return;

    setData(prev => {
      const next = { ...(prev || {}) };
      if (typeof next[key] === 'undefined') {
        next[key] = newFieldValue;
      }
      return next;
    });

    setNewFieldKey('');
    setNewFieldValue('');
  }

  function handleRemoveField(key) {
    if (!window.confirm(`Remove field "${key}" from this entry?`)) return;
    setData(prev => {
      const next = { ...(prev || {}) };
      delete next[key];
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Save / Delete
  // ---------------------------------------------------------------------------

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaveMessage('');

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    const finalSlug = slug.trim() || slugify(title);

    try {
      setSaving(true);

      // Mirror core fields into data so they survive even if the API
      // mostly persists JSON in entries.data.
      const mergedData = {
        ...(data || {}),
        title: title.trim(),
        slug: finalSlug,
        status,
        _title: title.trim(),
        _slug: finalSlug,
        _status: status,
      };

      const payload = {
        title: title.trim(),
        slug: finalSlug,
        status,
        data: mergedData,
      };

      if (isNew) {
        // CREATE
        const res = await api.post(`/api/content/${typeSlug}`, payload);
        if (res && res.ok === false) {
          throw new Error(res.error || res.detail || 'Failed to create entry');
        }

        const created = res.entry || res.data || res;

        // Try hard to find an ID from whatever the API returns
        const newId =
          created?.id ??
          created?.entry?.id ??
          created?.data?.id ??
          null;

        if (newId) {
          // Navigate to the new entry editor but keep user "on the entry"
          navigate(`/content/${typeSlug}/${newId}`, { replace: true });
          setSaveMessage('Entry created.');
        } else {
          // No ID found; don't bounce them away, just show a message
          setSaveMessage('Entry created (reload list to see it).');
        }
      } else {
        // UPDATE
        const res = await api.put(
          `/api/content/${typeSlug}/${entryId}`,
          payload
        );
        if (res && res.ok === false) {
          throw new Error(res.error || res.detail || 'Failed to save entry');
        }

        // Optionally hydrate from response if present
        const updated = res.entry || res.data || res;
        if (updated) {
          const entryData = updated.data || mergedData;
          const loadedTitle =
            updated.title ??
            entryData.title ??
            entryData._title ??
            title;
          const loadedSlug =
            updated.slug ??
            entryData.slug ??
            entryData._slug ??
            finalSlug;
          const loadedStatus =
            updated.status ??
            entryData.status ??
            entryData._status ??
            status;

          setTitle(loadedTitle);
          setSlug(loadedSlug);
          setStatus(loadedStatus);
          setData(entryData);
        }

        setSaveMessage('Entry saved.');
      }
    } catch (err) {
      console.error('Failed to save entry', err);
      setError(err.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew) {
      // nothing persisted yet, just go back
      navigate(`/content/${typeSlug}`);
      return;
    }

    if (!window.confirm('Delete this entry? This cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      setSaveMessage('');
      const res = await api.del(`/api/content/${typeSlug}/${entryId}`);
      if (res && res.ok === false) {
        throw new Error(res.error || res.detail || 'Failed to delete entry');
      }
      navigate(`/content/${typeSlug}`);
    } catch (err) {
      console.error('Failed to delete entry', err);
      setError(err.message || 'Failed to delete entry');
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Preview helpers
  // ---------------------------------------------------------------------------

  const previewData = useMemo(
    () => ({
      ...data,
      title,
      slug,
      status,
    }),
    [data, title, slug, status]
  );

  function prettyValue(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      return String(v);
    }
    if (Array.isArray(v)) {
      if (!v.length) return '';
      if (v.every(x => typeof x === 'string' || typeof x === 'number')) {
        return v.join(', ');
      }
      return JSON.stringify(v);
    }
    if (typeof v === 'object') {
      // simple label/value objects
      if (v.label && (typeof v.value === 'string' || typeof v.value === 'number')) {
        return `${v.label} (${v.value})`;
      }
      if (v.label && !v.value) return String(v.label);
      return JSON.stringify(v);
    }
    return String(v);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="su-grid cols-2">
      {/* LEFT: Editor card */}
      <div className="su-card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>
          {loading
            ? 'Edit entry'
            : isNew
            ? `New ${typeSlug} entry`
            : `Edit ${typeSlug}`}
        </h2>

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {saveMessage && !error && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #bbf7d0',
              background: '#ecfdf3',
              color: '#166534',
              fontSize: 13,
            }}
          >
            {saveMessage}
          </div>
        )}

        {loading && !isNew && (
          <p style={{ fontSize: 13, opacity: 0.7 }}>Loading entry…</p>
        )}

        <form onSubmit={handleSave}>
          {/* Core fields */}
          <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
            <label style={{ fontSize: 13 }}>
              Title
              <input
                className="su-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="My great entry"
              />
            </label>

            <label style={{ fontSize: 13 }}>
              Slug
              <input
                className="su-input"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder={slugify(title || 'my-entry')}
              />
            </label>

            <label style={{ fontSize: 13 }}>
              Status
              <select
                className="su-select"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          {/* Custom fields editor */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14 }}>Custom fields</h3>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                Stored in <code>entries.data</code>
              </span>
            </div>

            {customFieldEntries.length === 0 && (
              <p style={{ fontSize: 12, opacity: 0.7 }}>
                No fields yet. Add one below.
              </p>
            )}

            <div style={{ display: 'grid', gap: 10 }}>
              {customFieldEntries.map(([key, value]) => {
                const isSimple =
                  typeof value === 'string' ||
                  typeof value === 'number' ||
                  typeof value === 'boolean' ||
                  value === null;
                const displayValue = isSimple
                  ? String(value ?? '')
                  : JSON.stringify(value, null, 2);

                return (
                  <div
                    key={key}
                    style={{
                      border: '1px solid var(--su-border)',
                      borderRadius: 10,
                      padding: 10,
                      background: 'var(--su-surface)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{key}</div>
                      <button
                        type="button"
                        className="su-btn"
                        onClick={() => handleRemoveField(key)}
                        style={{ fontSize: 11, paddingInline: 8 }}
                      >
                        Remove
                      </button>
                    </div>

                    {isSimple ? (
                      <input
                        className="su-input"
                        value={displayValue}
                        onChange={e => updateCustomField(key, e.target.value)}
                      />
                    ) : (
                      <textarea
                        className="su-textarea"
                        rows={3}
                        value={displayValue}
                        onChange={e => updateCustomField(key, e.target.value)}
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        }}
                      />
                    )}

                    {!isSimple && (
                      <p style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                        Parsed as JSON (arrays / objects / booleans / numbers).
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add field */}
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--su-border)',
                display: 'grid',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px minmax(0,1fr)',
                  gap: 8,
                }}
              >
                <input
                  className="su-input"
                  placeholder="field_key"
                  value={newFieldKey}
                  onChange={e => setNewFieldKey(e.target.value)}
                />
                <input
                  className="su-input"
                  placeholder='Plain text or JSON (e.g. ["tag-1","tag-2"])'
                  value={newFieldValue}
                  onChange={e => setNewFieldValue(e.target.value)}
                />
              </div>
              <button
                className="su-btn primary"
                type="button"
                onClick={handleAddField}
              >
                Add custom field
              </button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="su-btn primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create entry' : 'Save entry'}
            </button>
            <button
              className="su-btn"
              type="button"
              onClick={() => navigate(-1)}
              disabled={saving}
            >
              Back
            </button>
            <button
              className="su-btn"
              type="button"
              onClick={handleDelete}
              disabled={saving}
              style={{
                borderColor: '#fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
              }}
            >
              {isNew ? 'Cancel' : 'Delete'}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT: Preview card */}
      <div className="su-card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Preview</h2>

        {/* "Physical" preview */}
        <div
          style={{
            borderRadius: 10,
            border: '1px solid var(--su-border)',
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {title || '(untitled entry)'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              /{slug || slugify(title || 'my-entry')} ·{' '}
              <span style={{ textTransform: 'uppercase' }}>{status}</span>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--su-border)',
              paddingTop: 8,
            }}
          >
            {customFieldEntries.length === 0 && (
              <p style={{ fontSize: 12, opacity: 0.7 }}>No custom fields yet.</p>
            )}
            {customFieldEntries.map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px minmax(0,1fr)',
                  gap: 8,
                  padding: '4px 0',
                  fontSize: 13,
                }}
              >
                <div style={{ opacity: 0.7 }}>{key}</div>
                <div>{prettyValue(value)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* JSON preview */}
        <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>
          Raw JSON (<code>entries.data</code>)
        </h3>
        <pre
          style={{
            fontSize: 11,
            background: '#0b1120',
            color: '#d1fae5',
            borderRadius: 10,
            padding: 10,
            maxHeight: 480,
            overflow: 'auto',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {JSON.stringify(previewData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
