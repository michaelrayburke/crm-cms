import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

// Built-in columns that exist on every entry coming from the API
const BUILTIN_KEYS = ['title', 'slug', 'status', 'created_at', 'updated_at'];

// Local-storage helpers so each content type "remembers" the last columns used
function loadListColumns(typeSlug) {
  try {
    const raw = window.localStorage.getItem(`su:list-columns:${typeSlug}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.warn('[TypeList] Failed to read list columns from localStorage', e);
  }
  return [];
}

function saveListColumns(typeSlug, cols) {
  try {
    window.localStorage.setItem(
      `su:list-columns:${typeSlug}`,
      JSON.stringify(cols || []),
    );
  } catch (e) {
    console.warn('[TypeList] Failed to save list columns', e);
  }
}

// Inspect the rows to discover all keys that can be shown as columns
function collectKeysFromRows(rows) {
  const set = new Set(BUILTIN_KEYS);
  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue;

    // top-level keys
    for (const key of Object.keys(row)) {
      if (key === 'id' || key === '_id' || key === 'data') continue;
      set.add(key);
    }

    // nested data object for custom fields
    if (row.data && typeof row.data === 'object') {
      for (const key of Object.keys(row.data)) {
        set.add(key);
      }
    }
  }
  return Array.from(set);
}

// For now we just use "title" as the label/identifier
function getIdentifierKeyForType() {
  return 'title';
}

export default function TypeList() {
  const navigate = useNavigate();
  const { type: typeSlugParam, typeSlug: typeSlugAlt } = useParams();

  // Depending on how the route is declared it might be :type or :typeSlug
  const typeSlug = typeSlugParam || typeSlugAlt;

  const role = 'ADMIN';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableKeys, setAvailableKeys] = useState([]);
  const [titleKey, setTitleKey] = useState('title');

  const [contentType, setContentType] = useState(null);

  // List-view state coming from the backend
  const [listViews, setListViews] = useState([]);
  const [activeViewSlug, setActiveViewSlug] = useState('');
  const [activeViewLabel, setActiveViewLabel] = useState('');

  const [columns, setColumns] = useState([]);

  // ---------------------------------------------------------------------------
  // Load entries, content-type metadata, and list views
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!typeSlug) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        // 1) Load entries for this content type (by slug)
        const entriesRes = await api.get(`/api/content/${typeSlug}`);
        const list = Array.isArray(entriesRes)
          ? entriesRes
          : entriesRes?.data || [];
        if (cancelled) return;
        setRows(list);

        const keys = collectKeysFromRows(list);
        if (cancelled) return;
        setAvailableKeys(keys);

        const idKey = getIdentifierKeyForType();
        setTitleKey(idKey);

        // 2) Try to resolve the content type + its list views
        let ct = null;
        let views = [];

        try {
          const typesRes = await api.get('/api/content-types');
          const types = typesRes?.data || typesRes || [];
          if (Array.isArray(types)) {
            ct = types.find(
              (t) =>
                t &&
                (t.slug === typeSlug ||
                  t.id === typeSlug ||
                  t.key === typeSlug),
            );
          }
        } catch (err) {
          console.warn(
            '[TypeList] Failed to load content types (will still show entries)',
            err?.response?.data || err,
          );
        }

        if (!cancelled) {
          setContentType(ct || null);
        }

        if (ct && ct.id) {
          try {
            const viewsRes = await api.get(
              `/api/content-types/${ct.id}/list-views`,
              {
                params: { role },
              },
            );
            views =
              (viewsRes.data && viewsRes.data.views) ||
              viewsRes.data ||
              [];
          } catch (err) {
            console.warn(
              '[TypeList] Failed to load list views for type; falling back to local layout',
              err?.response?.data || err,
            );
          }
        }

        if (cancelled) return;

        setListViews(views || []);

        const keySet = new Set(keys);
        let effectiveCols = [];

        if (views && views.length) {
          const active =
            views.find((v) => v.is_default) || views[0];

          setActiveViewSlug(active.slug);
          setActiveViewLabel(active.label || active.slug);

          const cfgCols = (active.config && active.config.columns) || [];
          const cfgKeys = cfgCols
            .map((c) => c.key)
            .filter((k) => k && keySet.has(k));

          if (cfgKeys.length) {
            effectiveCols = cfgKeys;
          }
        }

        // If no view-based configuration, fall back to localStorage or generic defaults
        if (!effectiveCols.length) {
          const storedCols = loadListColumns(typeSlug);
          const base = storedCols.length ? storedCols : keys;
          effectiveCols = base.filter(
            (k) => k && k !== 'id' && k !== '_id',
          );
          setActiveViewSlug('');
          setActiveViewLabel('');
        }

        if (cancelled) return;

        setColumns(effectiveCols);
        saveListColumns(typeSlug, effectiveCols);
      } catch (e) {
        console.error('[TypeList] Error loading entries', e);
        if (!cancelled) {
          setError('Failed to load entries for this content type.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [typeSlug, role]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const activeView = useMemo(() => {
    if (!listViews?.length || !activeViewSlug) return null;
    return (
      listViews.find((v) => v.slug === activeViewSlug) || null
    );
  }, [listViews, activeViewSlug]);

  const displayColumns = useMemo(() => {
    if (columns && columns.length) return columns;
    return BUILTIN_KEYS;
  }, [columns]);

  function handleClickNew() {
    if (!typeSlug) return;
    navigate(`/content/${typeSlug}/new`);
  }

  function handleClickRow(row) {
    const id = row.id || row._id;
    if (!typeSlug || !id) return;
    navigate(`/content/${typeSlug}/${id}`);
  }

  function handleChooseView(slug) {
    if (!slug) return;
    const v = listViews.find((x) => x.slug === slug);
    if (!v) return;

    setActiveViewSlug(slug);
    setActiveViewLabel(v.label || slug);

    const keysFromRows = collectKeysFromRows(rows);
    const keySet = new Set(keysFromRows);
    const cfgCols = (v.config && v.config.columns) || [];
    const cfgKeys = cfgCols
      .map((c) => c.key)
      .filter((k) => k && keySet.has(k));

    const nextCols = cfgKeys.length ? cfgKeys : keysFromRows;
    setColumns(nextCols);
    saveListColumns(typeSlug, nextCols);
  }

  function renderCell(row, key) {
    if (key === 'title') {
      return row.title || row.name || row.slug || '(untitled)';
    }
    if (key in row) {
      return row[key];
    }
    if (row.data && key in row.data) {
      return row.data[key];
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="su-page">
      <div className="su-page-header su-flex su-justify-between su-items-center su-mb-md">
        <div>
          <h1 className="su-page-title">
            {contentType?.name || contentType?.label || 'Entries'}
          </h1>
          <p className="su-page-subtitle">
            Manage entries for this content type.
          </p>
          {activeViewLabel && (
            <p className="su-text-xs su-text-muted">
              Using view: <strong>{activeViewLabel}</strong>{' '}
              {activeView?.is_default && '(default for this role)'}
            </p>
          )}
          {!activeViewLabel && listViews.length === 0 && (
            <p className="su-text-xs su-text-muted">
              No list views configured yet for role {role}. Using a
              fallback layout. You can customize columns in{' '}
              <strong>Settings → List Views</strong>.
            </p>
          )}
        </div>

        <div className="su-flex su-gap-sm">
          <button
            type="button"
            className="su-btn su-btn-primary"
            onClick={handleClickNew}
          >
            + New entry
          </button>
        </div>
      </div>

      {listViews.length > 0 && (
        <div className="su-card su-mb-md">
          <div className="su-card-body su-flex su-flex-wrap su-gap-sm su-items-center">
            <span className="su-text-sm su-text-muted">Views:</span>
            {listViews.map((v) => (
              <button
                key={v.slug}
                type="button"
                className={
                  'su-chip' +
                  (v.slug === activeViewSlug ? ' su-chip--active' : '')
                }
                onClick={() => handleChooseView(v.slug)}
              >
                {v.label || v.slug}
                {v.is_default && (
                  <span className="su-chip-badge">default</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="su-card">
        <div className="su-card-body">
          {loading && <p>Loading entries…</p>}
          {error && (
            <div className="su-alert su-alert-danger su-mb-md">
              {error}
            </div>
          )}

          {!loading && !rows.length && !error && (
            <p className="su-text-muted">
              No entries yet. Click “New entry” to create the first one.
            </p>
          )}

          {!!rows.length && (
            <div className="su-table-wrapper">
              <table className="su-table">
                <thead>
                  <tr>
                    {displayColumns.map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const id = row.id || row._id;
                    return (
                      <tr
                        key={id}
                        className="su-table-row su-table-row--clickable"
                        onClick={() => handleClickRow(row)}
                      >
                        {displayColumns.map((key) => (
                          <td key={key}>{renderCell(row, key)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="su-card su-mt-lg">
        <div className="su-card-header">
          <h2 className="su-card-title">Debug</h2>
        </div>
        <div className="su-card-body">
          <pre className="su-code-block">
            {JSON.stringify(
              {
                typeSlug,
                role,
                hasContentType: !!contentType,
                listViewsCount: listViews.length,
                activeViewSlug,
                activeViewLabel,
                columns: displayColumns,
                entriesCount: rows.length,
                availableKeys,
                titleKey,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
