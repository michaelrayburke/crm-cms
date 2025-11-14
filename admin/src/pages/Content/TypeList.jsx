import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

/**
 * Content list for a single type.
 * - Talks to /api/content/:slug
 * - Knows that entries look like: { id, data: {...}, created_at, updated_at }
 * - Lets you customize which data.* fields show as columns
 */

function getIdentifierKeyForType(typeSlug) {
  try {
    const map = JSON.parse(localStorage.getItem('serviceup.identifierKeyMap') || '{}');
    return map[typeSlug] || 'title';
  } catch {
    return 'title';
  }
}

function setIdentifierKeyForType(typeSlug, key) {
  try {
    const raw = localStorage.getItem('serviceup.identifierKeyMap') || '{}';
    const map = (() => {
      try { return JSON.parse(raw) || {}; } catch { return {}; }
    })();
    map[typeSlug] = key;
    localStorage.setItem('serviceup.identifierKeyMap', JSON.stringify(map));
  } catch {
    // ignore
  }
}

function loadListColumns(typeSlug) {
  try {
    const raw = localStorage.getItem('serviceup.listColumnsMap') || '{}';
    const map = JSON.parse(raw) || {};
    const cols = map[typeSlug];
    if (Array.isArray(cols)) return cols;
  } catch {
    // ignore
  }
  return [];
}

function saveListColumns(typeSlug, cols) {
  try {
    const raw = localStorage.getItem('serviceup.listColumnsMap') || '{}';
    const map = (() => {
      try { return JSON.parse(raw) || {}; } catch { return {}; }
    })();
    map[typeSlug] = cols;
    localStorage.setItem('serviceup.listColumnsMap', JSON.stringify(map));
  } catch {
    // ignore
  }
}

function collectKeysFromRows(rows) {
  const set = new Set();
  for (const r of rows) {
    const data = r?.data || {};
    Object.keys(data || {}).forEach((k) => set.add(k));
  }
  return Array.from(set).sort();
}

function formatValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '';
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return v.join(', ');
    }
    return JSON.stringify(v);
  }
  if (typeof v === 'object') {
    if (typeof v.label === 'string' && (v.value === undefined || typeof v.value !== 'object')) {
      return v.label;
    }
    if (typeof v.value === 'string' || typeof v.value === 'number') {
      return String(v.value);
    }
    return JSON.stringify(v);
  }
  return String(v);
}

export default function TypeList() {
  const { typeSlug } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [availableKeys, setAvailableKeys] = useState([]);
  const [titleKey, setTitleKey] = useState('title');
  const [columns, setColumns] = useState([]);
  const [editingColumns, setEditingColumns] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        // IMPORTANT: backend route is /api/content/:slug
        const res = await api.get(`/api/content/${typeSlug}`);
        const list = Array.isArray(res) ? res : res?.data || [];
        setRows(list);

        const keys = collectKeysFromRows(list);
        setAvailableKeys(keys);

        const idKey = getIdentifierKeyForType(typeSlug);
        setTitleKey(idKey);

        const storedCols = loadListColumns(typeSlug);
        const sanitizedCols = (storedCols.length ? storedCols : keys).filter(
          (k) => k && k !== idKey
        );
        setColumns(sanitizedCols);
      } catch (e) {
        console.error(e);
        setError('Unable to load content.');
      } finally {
        setLoading(false);
      }
    })();
  }, [typeSlug]);

  function addNew() {
    navigate(`/admin/content/${typeSlug}/new`);
  }

  async function removeEntry(entryId) {
    if (!entryId) return;
    const confirmed = window.confirm('Delete this entry permanently?');
    if (!confirmed) return;
    try {
      // Backend has DELETE /api/content/:slug/:id
      if (typeof api.del === 'function') {
        await api.del(`/api/content/${typeSlug}/${entryId}`);
      } else if (typeof api.delete === 'function') {
        await api.delete(`/api/content/${typeSlug}/${entryId}`);
      } else {
        await api.post(`/api/content/${typeSlug}/${entryId}/delete`, {});
      }
      setRows((prev) => prev.filter((r) => (r.id || r._id) !== entryId));
    } catch (e) {
      console.error(e);
      alert('Error deleting entry: ' + (e.message || String(e)));
    }
  }

  const titleLabel = useMemo(() => {
    if (availableKeys.includes(titleKey)) return titleKey;
    return 'Title';
  }, [titleKey, availableKeys]);

  if (loading) {
    return <div className="su-card">Loading content…</div>;
  }

  if (error) {
    return <div className="su-card su-error">{error}</div>;
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
        <h2 style={{ margin: 0 }}>{typeSlug}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="su-btn"
            type="button"
            onClick={() => setEditingColumns((v) => !v)}
          >
            {editingColumns ? 'Done Editing Columns' : 'Customize Columns'}
          </button>
          <button className="su-btn primary" onClick={addNew}>
            + Add {typeSlug.slice(0, 1).toUpperCase() + typeSlug.slice(1)}
          </button>
        </div>
      </div>

      {editingColumns && (
        <div
          className="su-card"
          style={{
            marginTop: 12,
            background: 'var(--su-surface-subtle)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>List View Settings</h3>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                Identifier (title) field
              </div>
              <select
                className="su-select"
                value={titleKey}
                onChange={(e) => {
                  const nextKey = e.target.value;
                  setTitleKey(nextKey);
                  setIdentifierKeyForType(typeSlug, nextKey);
                  setColumns((prev) => prev.filter((k) => k !== nextKey));
                }}
              >
                <option value="title">title</option>
                {availableKeys
                  .filter((k) => k && k !== 'title')
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                Columns to show
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {availableKeys.map((k) => {
                  if (!k || k === titleKey) return null;
                  const checked = columns.includes(k);
                  return (
                    <label
                      key={k}
                      style={{
                        border: '1px solid var(--su-border)',
                        borderRadius: 999,
                        padding: '2px 10px',
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...columns, k]
                            : columns.filter((c) => c !== k);
                          setColumns(next);
                          saveListColumns(typeSlug, next);
                        }}
                      />
                      <span>{k}</span>
                    </label>
                  );
                })}
                {availableKeys.length === 0 && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    No fields detected yet. Once you add entries with data, you
                    can configure columns here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <table className="su-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">{titleLabel}</th>
            {columns.map((key) => (
              <th key={key} align="left">
                {key}
              </th>
            ))}
            <th align="left">ID</th>
            <th align="left">Updated</th>
            <th align="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const id = r.id || r._id;
            const data = r.data || {};
            const title =
              data[titleKey] ?? data.title ?? data.name ?? `(id: ${id})`;
            const updated = r.updated_at || r.updatedAt || r.created_at || '-';

            return (
              <tr
                key={id}
                style={{ borderTop: '1px solid var(--su-border)' }}
              >
                <td>
                  <Link to={`/admin/content/${typeSlug}/${id}`}>
                    {formatValue(title) || '(untitled)'}
                  </Link>
                </td>
                {columns.map((key) => (
                  <td key={key}>{formatValue(data[key])}</td>
                ))}
                <td>{id}</td>
                <td>{updated}</td>
                <td align="right">
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      className="su-btn"
                      type="button"
                      onClick={() =>
                        navigate(`/admin/content/${typeSlug}/${id}`)
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="su-btn danger"
                      type="button"
                      onClick={() => removeEntry(id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={4 + columns.length}
                style={{ padding: '12px 0', opacity: 0.7 }}
              >
                No entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
