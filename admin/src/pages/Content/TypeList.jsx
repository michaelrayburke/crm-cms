import React, { useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';

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

// Heuristic helpers for rendering values nicely
function looksLikeDateKey(key) {
  return /date|_at$/i.test(key);
}

function looksLikeImageKey(key) {
  return /image|thumbnail|thumb|cover|photo|featured/i.test(key);
}

function looksLikeDescriptionKey(key) {
  return /description|desc|excerpt|summary|bio|content/i.test(key);
}

function formatDate(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function getImageUrlFromValue(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length) {
    // try first element
    return getImageUrlFromValue(value[0]);
  }
  if (typeof value === 'object') {
    if (value.url) return value.url;
    if (value.src) return value.src;
    // common file-ish shapes
    if (value.publicUrl) return value.publicUrl;
  }
  return null;
}

function summarizeArray(arr) {
  const len = arr.length;
  if (!len) return '';
  if (len === 1) {
    const v = arr[0];
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      return v.title || v.name || v.slug || JSON.stringify(v);
    }
    return String(v);
  }
  return `${len} items`;
}

export default function TypeList() {
  const navigate = useNavigate();
  const { type: typeSlugParam, typeSlug: typeSlugAlt } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Depending on how the route is declared it might be :type or :typeSlug
  const typeSlug = typeSlugParam || typeSlugAlt;

  // TODO: wire this to real auth role. For now we assume ADMIN.
  const role = 'ADMIN';
  const roleUpper = role.toUpperCase();

  // 🔔 listen for global “list views changed” bumps
  const { listViewsVersion } = useSettings();

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

        // 2) Try to resolve the content type
        let ct = null;

        try {
          const typesRes = await api.get('/api/content-types');
          const types = Array.isArray(typesRes)
            ? typesRes
            : typesRes?.data || [];
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

        // 3) Load list views for this content type + role
        let views = [];
        if (ct && ct.id) {
          try {
            const viewsRes = await api.get(
              `/api/content-types/${ct.id}/list-views?role=${encodeURIComponent(
                roleUpper,
              )}`,
            );

            const rawViews =
              (viewsRes && viewsRes.data) != null ? viewsRes.data : viewsRes;
            if (Array.isArray(rawViews)) {
              views = rawViews;
            } else if (rawViews && Array.isArray(rawViews.views)) {
              views = rawViews.views;
            } else {
              views = [];
            }
          } catch (err) {
            console.warn(
              '[TypeList] Failed to load list views for type; falling back to local layout',
              err?.response?.data || err,
            );
          }
        }

        if (cancelled) return;

        setListViews(views || []);

        const viewFromUrl = searchParams.get('view') || '';
        const keysFromRows = keys;

        let effectiveCols = [];
        let chosenView = null;

        if (views && views.length) {
          // Prefer view whose config.default_roles includes this role.
          const defaultView =
            views.find((v) => {
              const cfg = v.config || {};
              const dRoles = Array.isArray(cfg.default_roles)
                ? cfg.default_roles.map((r) =>
                    String(r || '').toUpperCase(),
                  )
                : [];
              if (dRoles.length) {
                return dRoles.includes(roleUpper);
              }
              // Legacy fallback: use is_default when default_roles not set
              return !!v.is_default;
            }) || views[0];

          // If URL asks for a specific view and it exists, honour it
          if (viewFromUrl) {
            const fromUrl = views.find((v) => v.slug === viewFromUrl);
            chosenView = fromUrl || defaultView;
          } else {
            chosenView = defaultView;
          }

          if (chosenView) {
            setActiveViewSlug(chosenView.slug);
            setActiveViewLabel(chosenView.label || chosenView.slug);

            const cfgCols =
              (chosenView.config && chosenView.config.columns) || [];
            // 🔑 Do NOT filter by keysFromRows — we always show configured columns
            const cfgKeys = cfgCols
              .map((c) => c.key)
              .filter(Boolean);

            if (cfgKeys.length) {
              effectiveCols = cfgKeys;
            }
          }
        }

        // If no view-based configuration, fall back to localStorage or generic defaults
        if (!effectiveCols.length) {
          const storedCols = loadListColumns(typeSlug);
          const base = storedCols.length ? storedCols : keysFromRows;
          effectiveCols = base.filter(
            (k) => k && k !== 'id' && k !== '_id',
          );
          if (!views || !views.length) {
            setActiveViewSlug('');
            setActiveViewLabel('');
            // Clean up any stale ?view= param
            if (searchParams.get('view')) {
              const next = new URLSearchParams(searchParams);
              next.delete('view');
              setSearchParams(next);
            }
          }
        } else {
          // Ensure URL matches chosenView when we do have list views
          if (chosenView) {
            const currentViewParam = searchParams.get('view');
            if (currentViewParam !== chosenView.slug) {
              const next = new URLSearchParams(searchParams);
              next.set('view', chosenView.slug);
              setSearchParams(next);
            }
          }
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
  }, [typeSlug, roleUpper, listViewsVersion, searchParams, setSearchParams]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const activeView = useMemo(() => {
    if (!listViews?.length || !activeViewSlug) return null;
    return listViews.find((v) => v.slug === activeViewSlug) || null;
  }, [listViews, activeViewSlug]);

  const activeViewIsDefaultForRole = useMemo(() => {
    if (!activeView) return false;
    const cfg = activeView.config || {};
    const dRoles = Array.isArray(cfg.default_roles)
      ? cfg.default_roles.map((r) => String(r || '').toUpperCase())
      : [];
    if (dRoles.length) {
      return dRoles.includes(roleUpper);
    }
    return !!activeView.is_default;
  }, [activeView, roleUpper]);

  const displayColumns = useMemo(() => {
    if (columns && columns.length) return columns;
    return BUILTIN_KEYS;
  }, [columns]);

  // ---------------------------------------------------------------------------
  // Navigation + view switching
  // ---------------------------------------------------------------------------
  function handleClickNew() {
    if (!typeSlug) return;
    // Use /admin prefix so it matches routes defined in App.jsx
    navigate(`/admin/content/${typeSlug}/new`);
  }

  function handleClickRow(row) {
    // Prefer slug for navigation; fall back to id if slug is missing
    if (!typeSlug) return;
    const slugOrId = row.slug || (row.data && (row.data.slug || row.data._slug)) || row.id || row._id;
    if (!slugOrId) return;
    navigate(`/admin/content/${typeSlug}/${slugOrId}`);
  }

  function handleChooseView(slug) {
    if (!slug) return;
    const v = listViews.find((x) => x.slug === slug);
    if (!v) return;

    setActiveViewSlug(slug);
    setActiveViewLabel(v.label || slug);

    const cfgCols = (v.config && v.config.columns) || [];
    const cfgKeys = cfgCols
      .map((c) => c.key)
      .filter(Boolean);

    const keysFromRows = collectKeysFromRows(rows);
    const nextCols = cfgKeys.length ? cfgKeys : keysFromRows;

    setColumns(nextCols);
    saveListColumns(typeSlug, nextCols);

    // Update ?view= in the URL for deep-linking
    const next = new URLSearchParams(searchParams);
    next.set('view', slug);
    setSearchParams(next);
  }

  // ---------------------------------------------------------------------------
  // Render one cell with heuristics for images, text, dates, etc.
  // ---------------------------------------------------------------------------
  function renderCell(row, key) {
    let value;
    if (key === 'title') {
      // Prefer title-ish fields for the main identifier. Fall back to nested data.
      value =
        row.title ||
        row.name ||
        row.slug ||
        (row.data && (row.data.title || row.data.name || row.data.slug)) ||
        '(untitled)';
    } else if (key in row) {
      value = row[key];
    } else if (row.data && key in row.data) {
      value = row.data[key];
    } else {
      value = undefined;
    }

    if (value === null || typeof value === 'undefined') {
      return '';
    }

    // Booleans
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    // Arrays
    if (Array.isArray(value)) {
      if (looksLikeImageKey(key)) {
        const url = getImageUrlFromValue(value);
        if (url) {
          return (
            <img
              src={url}
              alt=""
              className="su-table-img-thumb"
              loading="lazy"
            />
          );
        }
      }
      return summarizeArray(value);
    }

    // Objects
    if (value && typeof value === 'object') {
      if (looksLikeImageKey(key)) {
        const url = getImageUrlFromValue(value);
        if (url) {
          return (
            <img
              src={url}
              alt=""
              className="su-table-img-thumb"
              loading="lazy"
            />
          );
        }
      }
      // Generic object: try some common fields before falling back
      const labelish =
        value.title ||
        value.name ||
        value.slug ||
        value.filename ||
        value.file_name;
      if (labelish) return labelish;
      return JSON.stringify(value);
    }

    // Strings
    if (typeof value === 'string') {
      // Date-ish
      if (looksLikeDateKey(key) || /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return formatDate(value);
      }

      // Image-ish string (URL)
      if (looksLikeImageKey(key) && /^https?:\/\//i.test(value)) {
        return (
          <img
            src={value}
            alt=""
            className="su-table-img-thumb"
            loading="lazy"
          />
        );
      }

      // Description-ish: truncate
      if (looksLikeDescriptionKey(key)) {
        const max = 80;
        if (value.length > max) {
          return value.slice(0, max - 1) + '…';
        }
        return value;
      }

      return value;
    }

    // Numbers and anything else
    return String(value);
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
              {activeViewIsDefaultForRole && '(default for this role)'}
            </p>
          )}
          {!activeViewLabel && listViews.length === 0 && (
            <p className="su-text-xs su-text-muted">
              No list views configured yet for role {roleUpper}. Using a
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
            {listViews.map((v) => {
              const cfg = v.config || {};
              const dRoles = Array.isArray(cfg.default_roles)
                ? cfg.default_roles.map((r) =>
                    String(r || '').toUpperCase(),
                  )
                : [];
              const isDefaultForRole = dRoles.length
                ? dRoles.includes(roleUpper)
                : !!v.is_default;

              return (
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
                  {isDefaultForRole && (
                    <span className="su-chip-badge">default</span>
                  )}
                </button>
              );
            })}
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
                role: roleUpper,
                hasContentType: !!contentType,
                listViewsCount: listViews.length,
                activeViewSlug,
                activeViewLabel,
                activeViewIsDefaultForRole,
                columns: displayColumns,
                entriesCount: rows.length,
                availableKeys,
                titleKey,
                listViewsVersion,
                urlViewParam: searchParams.get('view'),
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