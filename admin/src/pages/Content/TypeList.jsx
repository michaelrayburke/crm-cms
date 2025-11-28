import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";

// Built-in columns that exist on every entry
const BUILTIN_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "slug", label: "Slug" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
];

// Simple helper to build a fallback column set when no list views exist
function buildFallbackColumns(contentType) {
  const fields = Array.isArray(contentType?.fields) ? contentType.fields : [];

  const fieldColumns = fields.slice(0, 3).map((f) => ({
    key: f.key,
    label: f.label || f.name || f.key,
  }));

  const base = [...BUILTIN_COLUMNS];
  for (const col of fieldColumns) {
    if (!base.find((b) => b.key === col.key)) {
      base.push(col);
    }
  }
  return base;
}

export default function TypeList() {
  console.log("🔥 TypeList.jsx is running and loaded");

  const { slug } = useParams(); // e.g., "songs"
  const [contentTypes, setContentTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState("");

  // List-view specific state
  const [listViews, setListViews] = useState([]);
  const [activeViewSlug, setActiveViewSlug] = useState("");
  const [columns, setColumns] = useState([]);

  // For now we just use ADMIN; later we can pull this from the JWT or user context
  const role = "ADMIN";

  // --------------------------------------------------
  // Load all content types (for metadata + ID lookup)
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingTypes(true);
        const res = await api.get("/api/content-types");
        if (cancelled) return;
        const list = res.data || [];

        // Keep a stable sorted list (optional)
        list.sort((a, b) => {
          const an = (a.name || a.slug || "").toLowerCase();
          const bn = (b.name || b.slug || "").toLowerCase();
          return an.localeCompare(bn);
        });

        setContentTypes(list);
      } catch (err) {
        console.error("[TypeList] failed to load content types", err);
        if (!cancelled) {
          setError("Failed to load content types");
        }
      } finally {
        if (!cancelled) {
          setLoadingTypes(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // --------------------------------------------------
  // Derive the active content type from the slug
  // --------------------------------------------------
  const activeContentType = useMemo(() => {
    if (!contentTypes || !contentTypes.length || !slug) return null;
    return (
      contentTypes.find((ct) => ct.slug === slug) ||
      contentTypes.find((ct) => String(ct.id) === String(slug)) ||
      null
    );
  }, [contentTypes, slug]);

  // --------------------------------------------------
  // Load entries for this content type (by slug)
  // --------------------------------------------------
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingEntries(true);
        setError("");
        const res = await api.get(`/api/content/${slug}`);
        if (cancelled) return;
        setEntries(res.data || []);
      } catch (err) {
        console.error("[TypeList] failed to load entries", err);
        if (!cancelled) {
          setError("Failed to load entries");
        }
      } finally {
        if (!cancelled) {
          setLoadingEntries(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // --------------------------------------------------
  // Load list views for this content type & role (by ID)
  // --------------------------------------------------
  useEffect(() => {
    if (!activeContentType || !activeContentType.id) {
      // No CT yet: fallback columns until we know more
      setColumns(buildFallbackColumns(activeContentType));
      setListViews([]);
      setActiveViewSlug("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setError("");
        const res = await api.get(
          `/api/content-types/${activeContentType.id}/list-views`,
          { params: { role } }
        );

        if (cancelled) return;

        const loaded = (res.data && res.data.views) || [];
        setListViews(loaded);

        if (!loaded.length) {
          // No views configured: fallback
          setActiveViewSlug("");
          setColumns(buildFallbackColumns(activeContentType));
          return;
        }

        // Pick default view (or first)
        const def = loaded.find((v) => v.is_default) || loaded[0];
        setActiveViewSlug(def.slug);

        const cfgCols = def.config?.columns || [];
        if (Array.isArray(cfgCols) && cfgCols.length) {
          setColumns(cfgCols);
        } else {
          setColumns(buildFallbackColumns(activeContentType));
        }
      } catch (err) {
        console.error("[TypeList] failed to load list views", err);
        if (!cancelled) {
          // If list views request fails, we still want a usable table
          setListViews([]);
          setActiveViewSlug("");
          setColumns(buildFallbackColumns(activeContentType));
          // Optionally surface a mild error
          // setError("Failed to load list views; using fallback layout");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeContentType, role]);

  // --------------------------------------------------
  // Helpers to render cell values
  // --------------------------------------------------
  const builtinKeys = new Set(BUILTIN_COLUMNS.map((c) => c.key));

  const renderCellValue = (entry, col) => {
    const key = col.key;
    if (builtinKeys.has(key)) {
      return entry[key] ?? "";
    }
    // Custom field stored under entry.data[key]
    const dataVal = entry.data ? entry.data[key] : undefined;
    if (dataVal == null) return "";

    if (typeof dataVal === "object") {
      try {
        return JSON.stringify(dataVal);
      } catch {
        return String(dataVal);
      }
    }
    return String(dataVal);
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  const title =
    activeContentType?.name || activeContentType?.slug || slug || "Entries";

  const noViewsConfigured = listViews.length === 0;

  return (
    <div className="su-page">
      <div className="su-page-header">
        <div>
          <h1 className="su-page-title">{title}</h1>
          <p className="su-page-subtitle">
            Manage entries for this content type.
          </p>
        </div>
        <div className="su-page-actions">
          {activeContentType && (
            <Link
              className="su-btn su-btn-primary"
              to={`/content/${activeContentType.slug}/new`}
            >
              + New {activeContentType.singular || "entry"}
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="su-alert su-alert-danger su-mb-md">{error}</div>
      )}

      {noViewsConfigured && (
        <div className="su-alert su-alert-info su-mb-md">
          No list views configured yet for role <strong>{role}</strong>. Using a
          fallback layout. You can customize columns in{" "}
          <Link to="/settings/list-views">Settings → List Views</Link>.
        </div>
      )}

      {(loadingTypes || loadingEntries) && (
        <div className="su-card su-mb-lg">
          <div className="su-card-body">Loading…</div>
        </div>
      )}

      {!loadingTypes && !loadingEntries && (
        <div className="su-card">
          <div className="su-card-header">
            <h2 className="su-card-title">Entries</h2>
            <p className="su-card-subtitle">
              Showing {entries.length} entr{entries.length === 1 ? "y" : "ies"}{" "}
              using view{" "}
              {activeViewSlug ? <code>{activeViewSlug}</code> : "fallback"}.
            </p>
          </div>
          <div className="su-card-body su-table-wrapper">
            {entries.length === 0 ? (
              <p className="su-text-muted">
                No entries yet. Click &ldquo;New&rdquo; to create the first one.
              </p>
            ) : (
              <table className="su-table su-table-striped su-w-full">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      {columns.map((col) => (
                        <td key={col.key}>{renderCellValue(entry, col)}</td>
                      ))}
                      <td>
                        {activeContentType && (
                          <Link
                            className="su-link"
                            to={`/content/${activeContentType.slug}/${entry.id}`}
                          >
                            Edit
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Debug section (optional, can remove later) */}
      <div className="su-card su-mt-lg">
        <div className="su-card-header">
          <h2 className="su-card-title">Debug</h2>
        </div>
        <div className="su-card-body">
          <pre className="su-code-block">
            {JSON.stringify(
              {
                slugFromRoute: slug,
                activeContentType: activeContentType
                  ? {
                      id: activeContentType.id,
                      slug: activeContentType.slug,
                      name: activeContentType.name,
                    }
                  : null,
                role,
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
