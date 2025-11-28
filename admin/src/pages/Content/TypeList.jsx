import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { StatusChip } from '../../components/StatusChip';
import { StatusDot } from '../../components/StatusDot';
import { Avatar } from '../../components/Avatar';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Filter,
  MoreHorizontal,
  Plus,
  Settings2,
  X,
} from 'lucide-react';

function getIdentifierKeyForType(type) {
  if (!type) return 'id';
  if (type.identifierKey) return type.identifierKey;
  // Fallbacks
  if (type.fields?.some((f) => f.key === 'slug')) return 'slug';
  if (type.fields?.some((f) => f.key === 'title')) return 'title';
  return 'id';
}

function formatValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    if (!value.length) return '';
    if (typeof value[0] === 'object') {
      return value
        .map((item) => item.title || item.name || item.slug || item.id)
        .join(', ');
    }
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return value.title || value.name || value.slug || value.id || JSON.stringify(value);
  }
  return String(value);
}

function collectKeysFromRows(rows) {
  const keys = new Set();
  rows.forEach((row) => {
    Object.keys(row.data || {}).forEach((k) => keys.add(k));
  });
  return Array.from(keys);
}

function loadListColumns(typeSlug, rows) {
  try {
    const raw = window.localStorage.getItem(`su:listColumns:${typeSlug}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    // ignore
  }
  // fallback: first few keys from data
  const keys = collectKeysFromRows(rows);
  return keys.slice(0, 4);
}

function saveListColumns(typeSlug, columns) {
  try {
    window.localStorage.setItem(
      `su:listColumns:${typeSlug}`,
      JSON.stringify(columns || []),
    );
  } catch (e) {
    // ignore
  }
}

export default function TypeList() {
  const { slug: typeSlug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contentMeta, setContentMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');
  const [editingColumns, setEditingColumns] = useState(false);

  // NEW: content types + list-view wiring
  const [contentTypes, setContentTypes] = useState([]);
  const [listViewNotice, setListViewNotice] = useState('');

  // Load all content types so we can resolve the content-type id (needed for list view API).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/content-types');
        if (cancelled) return;
        setContentTypes(res.data || []);
      } catch (err) {
        console.error('[TypeList] failed to load content types for list views', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeContentType = useMemo(() => {
    if (!typeSlug || !contentTypes || !contentTypes.length) return null;
    return (
      contentTypes.find((ct) => ct.slug === typeSlug) ||
      contentTypes.find((ct) => String(ct.id) === String(typeSlug)) ||
      null
    );
  }, [contentTypes, typeSlug]);

  // Load entries for this type
  useEffect(() => {
    if (!typeSlug) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const res = await api.get(`/api/content/${typeSlug}`, {
          params: {
            q: searchTerm || undefined,
          },
        });

        if (cancelled) return;

        const payload = res.data || {};
        const data = Array.isArray(payload.data) ? payload.data : [];
        const meta = payload.meta || null;

        setRows(data);
        setContentMeta(meta);

        // If we don't have columns yet, try to load from local storage
        // (this is our fallback when no server list views exist).
        if (!columns.length && data.length) {
          const loaded = loadListColumns(typeSlug, data);
          setColumns(loaded);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[TypeList] failed to load content', err);
        setError(
          err?.response?.data?.message ||
            'Unable to load entries for this content type.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [typeSlug, searchTerm]); // columns intentionally omitted

  // Load server-defined list views for this content type and role (currently ADMIN-only).
  useEffect(() => {
    if (!activeContentType || !activeContentType.id) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(
          `/api/content-types/${activeContentType.id}/list-views`,
          { params: { role: 'ADMIN' } },
        );

        if (cancelled) return;

        const data = res.data || {};
        const views = (data && data.views) || [];

        if (!Array.isArray(views) || !views.length) {
          setListViewNotice(
            'No list views configured yet for this content type and role. Using a fallback layout.',
          );
          return;
        }

        const def = views.find((v) => v.is_default) || views[0];
        const cols = (def.config && def.config.columns) || [];
        const keys = cols.map((c) => c.key).filter(Boolean);

        if (!keys.length) {
          setListViewNotice(
            'Active list view has no columns configured. Using a fallback layout.',
          );
          return;
        }

        setListViewNotice('');
        setColumns(keys);
        saveListColumns(typeSlug, keys);
      } catch (err) {
        console.error('[TypeList] failed to load list views', err);
        if (!cancelled) {
          setListViewNotice(
            'Could not load list views from the server. Using a fallback layout.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeContentType, typeSlug]);

  const identifierKey = useMemo(
    () => getIdentifierKeyForType(contentMeta?.type),
    [contentMeta],
  );

  const processedRows = useMemo(() => {
    let data = [...rows];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter((row) => {
        const title = row.title || row.data?.title || '';
        const slug = row.slug || '';
        const id = String(row.id || '');
        return (
          title.toLowerCase().includes(term) ||
          slug.toLowerCase().includes(term) ||
          id.toLowerCase().includes(term)
        );
      });
    }

    if (sortKey) {
      data.sort((a, b) => {
        const av =
          sortKey === 'updated_at'
            ? a.updated_at
            : sortKey === 'created_at'
            ? a.created_at
            : a.data?.[sortKey];
        const bv =
          sortKey === 'updated_at'
            ? b.updated_at
            : sortKey === 'created_at'
            ? b.created_at
            : b.data?.[sortKey];

        const aVal = av == null ? '' : av;
        const bVal = bv == null ? '' : bv;

        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [rows, searchTerm, sortKey, sortDir]);

  async function removeEntry(id) {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    try {
      await api.delete(`/api/content/${typeSlug}/${id}`);
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      console.error('[TypeList] failed to delete entry', err);
      alert('Failed to delete entry.');
    }
  }

  function handleToggleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function prettifyKey(key) {
    if (!key) return '';
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  const titleKey =
    contentMeta?.type?.fields?.find((f) => f.isTitle)?.key || 'title';

  const typeLabel =
    contentMeta?.type?.label_plural || contentMeta?.type?.label || typeSlug;

  const hasAnyColumns = columns && columns.length > 0;

  return (
    <div className="su-page su-page-content-list">
      <div className="su-page-header">
        <div>
          <h1 className="su-page-title">{typeLabel}</h1>
          {contentMeta?.type?.description && (
            <p className="su-page-subtitle">{contentMeta.type.description}</p>
          )}
        </div>
        <div className="su-page-actions">
          <button
            type="button"
            className="su-btn su-btn-primary"
            onClick={() => navigate(`/admin/content/${typeSlug}/new`)}
          >
            <Plus size={16} />
            <span>New {contentMeta?.type?.label || 'Entry'}</span>
          </button>
        </div>
      </div>

      <div className="su-toolbar su-gap-md">
        <div className="su-toolbar-left">
          <div className="su-search-input">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, slug, ID…"
            />
            {searchTerm && (
              <button
                type="button"
                className="su-icon-btn"
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="su-toolbar-right">
          <button
            type="button"
            className="su-icon-btn"
            onClick={() => setEditingColumns((v) => !v)}
            title="Show/hide columns"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {listViewNotice && (
        <div className="su-alert su-alert-info su-mb-sm">{listViewNotice}</div>
      )}

      {editingColumns && (
        <div className="su-card su-mb-md">
          <div className="su-card-header">
            <div className="su-card-title">Columns to show</div>
            <button
              type="button"
              className="su-icon-btn"
              onClick={() => setEditingColumns(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="su-card-body su-columns-picker">
            {collectKeysFromRows(rows).map((key) => {
              const checked = columns.includes(key);
              return (
                <label key={key} className="su-checkbox-pill">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...columns, key]
                        : columns.filter((k) => k !== key);
                      setColumns(next);
                      saveListColumns(typeSlug, next);
                    }}
                  />
                  <span>{prettifyKey(key)}</span>
                </label>
              );
            })}
            {!rows.length && (
              <div className="su-text-muted">
                No data yet – columns will appear once you add entries.
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="su-alert su-alert-error su-mb-md">
          {error}{' '}
          <button
            type="button"
            className="su-link"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )}

      <div className="su-table-wrapper">
        <table className="su-table su-table-content">
          <thead>
            <tr>
              <th
                style={{ width: '40%' }}
                onClick={() => handleToggleSort(titleKey)}
                className="su-table-sortable"
              >
                <div className="su-table-header-cell">
                  <span>Title</span>
                  <ArrowUpDown size={14} />
                </div>
              </th>

              {hasAnyColumns &&
                columns.map((key) => (
                  <th
                    key={key}
                    onClick={() => handleToggleSort(key)}
                    className="su-table-sortable"
                  >
                    <div className="su-table-header-cell">
                      <span>{prettifyKey(key)}</span>
                      <ArrowUpDown size={14} />
                    </div>
                  </th>
                ))}

              <th
                onClick={() => handleToggleSort('id')}
                className="su-table-sortable"
              >
                <div className="su-table-header-cell">
                  <span>ID</span>
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('updated_at')}
                className="su-table-sortable"
              >
                <div className="su-table-header-cell">
                  <span>Updated</span>
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4 + (columns?.length || 0)}>Loading…</td>
              </tr>
            )}

            {!loading &&
              processedRows.map((row) => {
                const id = row[identifierKey] || row.id;
                const title =
                  row.title || row.data?.[titleKey] || row.data?.title;
                const updated = row.updated_at
                  ? new Date(row.updated_at).toLocaleString()
                  : '';

                return (
                  <tr key={id}>
                    <td>
                      <Link to={`/admin/content/${typeSlug}/${id}`}>
                        {formatValue(title) || '(untitled)'}
                      </Link>
                    </td>
                    {hasAnyColumns &&
                      columns.map((key) => (
                        <td key={key}>{formatValue(row.data?.[key])}</td>
                      ))}
                    <td>{id}</td>
                    <td>{updated}</td>
                    <td align="right">
                      <div className="su-row-actions">
                        <Link
                          to={`/admin/content/${typeSlug}/${id}`}
                          className="su-link"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="su-link su-link-danger"
                          onClick={() => removeEntry(id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

            {!loading && processedRows.length === 0 && (
              <tr>
                <td
                  colSpan={4 + (columns?.length || 0)}
                  style={{ padding: '12px 0', opacity: 0.7 }}
                >
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
