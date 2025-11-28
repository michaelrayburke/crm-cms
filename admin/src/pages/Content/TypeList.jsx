import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

// Built-in columns that exist on every entry
const BUILTIN_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "slug", label: "Slug" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
];

const FALLBACK_COLUMNS = BUILTIN_COLUMNS;

// For now we hard-code ADMIN; later we can wire this to the real user role
const ROLE = "ADMIN";

function renderCell(entry, col) {
  const key = col.key;

  // Built-ins
  if (key === "title") return entry.title || "(untitled)";
  if (key === "slug") return entry.slug || "";
  if (key === "status") return entry.status || "draft";
  if (key === "created_at") {
    return entry.created_at ? new Date(entry.created_at).toLocaleString() : "";
  }
  if (key === "updated_at") {
    return entry.updated_at ? new Date(entry.updated_at).toLocaleString() : "";
  }

  // Custom fields live under entry.data
  const data = entry.data || {};
  const value = data[key];

  if (value == null) return "";

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }

  return String(value);
}

export default function TypeList() {
  const { typeSlug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState("");

  const [contentTypes, setContentTypes] = useState([]);
  const [activeContentType, setActiveContentType] = useState(null);

  const [entries, setEntries] = useState([]);

  const [listViews, setListViews] = useState([]);
  const [activeViewSlug, setActiveViewSlug] = useState("");
  const [columns, setColumns] = useState(FALLBACK_COLUMNS);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Load content types, then list views + entries for this slug
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        // 1) Load all content types
        const ctRes = await api.get("/api/content-types");
        const list = ctRes.data || [];
        if (cancelled) return;
        setContentTypes(list);

        // 2) Find the active content type by slug
        const ct =
          list.find(
            (t) =>
              t.slug === typeSlug ||
              t.id === typeSlug ||
              t.key === typeSlug
          ) || null;

        setActiveContentType(ct || null);

        if (!ct) {
          setError("Content type not found");
          setListViews([]);
          setColumns(FALLBACK_COLUMNS);
          setEntries([]);
          return;
        }

        // 3) Load list views for this type + role
        try {
          const lvRes = await api.get(
            `/api/content-types/${ct.id}/list-views`,
            {
              params: { role: ROLE },
            }
          );
          if (cancelled) return;

          const views = (lvRes.data && lvRes.data.views) || [];
          setListViews(views);

          if (views.length) {
            const def = views.find((v) => v.is_default) || views[0];
            setActiveViewSlug(def.slug);

            const cfgCols =
              def.config && Array.isArray(def.config.columns)
                ? def.config.columns
                : [];

            if (cfgCols.length) {
              setColumns(cfgCols);
            } else {
              setColumns(FALLBACK_COLUMNS);
            }
          } else {
            // No views configured -> use fallback
            setActiveViewSlug("");
            setColumns(FALLBACK_COLUMNS);
          }
        } catch (err) {
          console.error("[TypeList] failed to load list views", err);
          if (cancelled) return;
          // Graceful fallback if 400/404 or other error
          setListViews([]);
          setActiveViewSlug("");
          setColumns(FALLBACK_COLUMNS);
        }

        // 4) Load entries
        try {
          setLoadingEntries(true);
          const eRes = await api.get(`/api/content/${ct.slug}`);
          if (cancelled) return;

          const raw = eRes.data;
          const items = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.items)
            ? raw.items
            : [];
          setEntries(items);
        } catch (err) {
          console.error("[TypeList] failed to load entries", err);
          if (!cancelled) {
            setError("Failed to load entries");
            setEntries([]);
          }
        } finally {
          if (!cancelled) setLoadingEntries(false);
        }
      } catch (err) {
        console.error("[TypeList] load error", err);
        if (!cancelled) {
          setError("Failed to load content type");
          setListViews([]);
          setColumns(FALLBACK_COLUMNS);
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [typeSlug]);

  const hasConfiguredViews = listViews.length > 0;

  const activeView = useMemo(() => {
    if (!hasConfiguredViews || !activeViewSlug) return null;
    return listViews.find((v) => v.slug === activeViewSlug) || null;
  }, [hasConfiguredViews, activeViewSlug, listViews]);

  const handleChangeView = (slug) => {
    const v = listViews.find((x) => x.slug === slug);
    if (!v) return;
    setActiveViewSlug(v.slug);

    const cfgCols =
      v.config && Array.isArray(v.config.columns) ? v.config.columns : [];
    setColumns(cfgCols.length ? cfgCols : FALLBACK_COLUMNS);
  };

  const filteredEntries = useMemo(() => {
    let list = entries || [];
    if (statusFilter !== "ALL") {
      list = list.filter((e) => (e.status || "draft") === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) => {
        const t = (e.title || "").toLowerCase();
        const s = (e.slug || "").toLowerCase();
        return t.includes(q) || s.includes(q);
      });
    }
    return list;
  }, [entries, statusFilter, search]);

  const handleNew = () => {
    if (!activeContentType) return;
    navigate(`/content/${activeContentType.slug}/new`);
  };

  const handleRowClick = (entry) => {
    if (!activeContentType || !entry.id) return;
    navigate(`/content/${activeContentType.slug}/${entry.id}`);
  };

  if (loading && !activeContentType) {
    return (
      <div className="su-page su-page-content">
        <div className="su-page-header">
          <h1 className="su-page-title">Entries</h1>
          <p className="su-page-subtitle">Loading content…</p>
        </div>
      </div>
    );
  }

  if (error && !activeContentType) {
    return (
      <div className="su-page su-page-content">
        <div className="su-page-header">
          <h1 className="su-page-title">Entries</h1>
          <p className="su-page-subtitle su-text-danger">{error}</p>
          <p className="su-page-subtitle">
            <Link to="/content" className="su-link">
              ← Back to all content types
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="su-page su-page-content">
      <div className="su-page-header su-flex su-justify-between su-items-center su-gap-md">
        <div>
          <h1 className="su-page-title">
            {activeContentType?.name || "Entries"}
          </h1>
          <p className="su-page-subtitle">
            Manage entries for this content type.
          </p>

          <div className="su-mt-xs su-text-xs su-text-muted">
            {hasConfiguredViews ? (
              <span>
                Showing list view{" "}
                <strong>{activeView?.label || activeViewSlug}</strong> for role{" "}
                <code>{ROLE}</code>. Customize in{" "}
                <Link to="/settings/list-views" className="su-link">
                  Settings → List Views
                </Link>
                .
              </span>
            ) : (
              <span>
                No list views configured yet for role{" "}
                <code>{ROLE}</code>. Using a fallback layout. You can customize
                columns in{" "}
                <Link to="/settings/list-views" className="su-link">
                  Settings → List Views
                </Link>
                .
              </span>
            )}
          </div>
        </div>

        <div className="su-flex su-gap-sm">
          <button
            type="button"
            className="su-btn su-btn-secondary"
            onClick={() => navigate("/content")}
          >
            ← All types
          </button>
          <button
            type="button"
            className="su-btn su-btn-primary"
            onClick={handleNew}
            disabled={!activeContentType}
          >
            + New
          </button>
        </div>
      </div>

      {/* View switcher */}
      {hasConfiguredViews && (
        <div className="su-card su-mb-md">
          <div className="su-card-body">
            <div className="su-flex su-flex-wrap su-gap-xs su-items-center">
              <span className="su-text-xs su-text-muted">Views:</span>
              {listViews.map((v) => (
                <button
                  key={v.slug}
                  type="button"
                  className={
                    "su-chip" +
                    (v.slug === activeViewSlug ? " su-chip--active" : "")
                  }
                  onClick={() => handleChangeView(v.slug)}
                >
                  {v.label}
                  {v.is_default && (
                    <span className="su-chip-badge">default</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="su-card su-mb-md">
        <div className="su-card-body su-flex su-flex-wrap su-gap-md su-items-center">
          <div className="su-field">
            <label className="su-label su-label-sm">Search</label>
            <input
              className="su-input su-input-sm"
              placeholder="Search by title or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="su-field">
            <label className="su-label su-label-sm">Status</label>
            <select
              className="su-input su-input-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="su-text-xs su-text-muted su-ml-auto">
            Showing {filteredEntries.length} of {entries.length} entries
          </div>
        </div>
      </div>

      {/* Entries table */}
      <div className="su-card">
        <div className="su-card-body su-table-wrapper">
          {loadingEntries ? (
            <p className="su-text-muted">Loading entries…</p>
          ) : filteredEntries.length === 0 ? (
            <p className="su-text-muted">
              No entries yet. Click{" "}
              <button
                type="button"
                className="su-link-button"
                onClick={handleNew}
                disabled={!activeContentType}
              >
                New
              </button>{" "}
              to create the first one.
            </p>
          ) : (
            <table className="su-table su-table-hover">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="su-table-row-clickable"
                    onClick={() => handleRowClick(entry)}
                  >
                    {columns.map((col) => (
                      <td key={col.key}>{renderCell(entry, col)}</td>
                    ))}
                    <td className="su-text-right">
                      <button
                        type="button"
                        className="su-btn su-btn-link su-btn-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(entry);
                        }}
                      >
                        Edit →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Debug block to verify list view wiring */}
      <div className="su-card su-mt-lg">
        <div className="su-card-header">
          <h2 className="su-card-title">Debug</h2>
          <p className="su-card-subtitle su-text-xs">
            This is just to verify list view wiring; you can remove it later.
          </p>
        </div>
        <div className="su-card-body">
          <pre className="su-code-block su-text-xs">
            {JSON.stringify(
              {
                typeSlug,
                activeContentType: activeContentType
                  ? { id: activeContentType.id, slug: activeContentType.slug }
                  : null,
                role: ROLE,
                listViews,
                activeViewSlug,
                columns,
                entriesCount: entries.length,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
