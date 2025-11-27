import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";

const FALLBACK_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "updated_at", label: "Updated" },
];

function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

function renderCellValue(val) {
  if (val == null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") {
    try {
      const json = JSON.stringify(val);
      return json.length > 80 ? json.slice(0, 77) + "…" : json;
    } catch {
      return "[object]";
    }
  }
  return String(val);
}

export default function TypeList() {
  const { typeSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [contentType, setContentType] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [views, setViews] = useState([]);
  const [activeViewSlug, setActiveViewSlug] = useState("");
  const [columns, setColumns] = useState(FALLBACK_COLUMNS);
  const [role] = useState("ADMIN"); // TODO: derive from auth context later

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 25;

  // ---------------------------------------------
  // Load content type meta + list views
  // ---------------------------------------------
  useEffect(() => {
    if (!typeSlug) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setViews([]);
        setColumns(FALLBACK_COLUMNS);
        setActiveViewSlug("");

        // 1) Load all content types and find by slug OR id
        const ctRes = await api.get("/api/content-types");
        if (cancelled) return;

        const list = ctRes.data || [];
        const ct =
          list.find((c) => c.slug === typeSlug) ||
          list.find((c) => c.id === typeSlug) ||
          null;

        if (!ct) {
          if (!cancelled) {
            setContentType(null);
            setError("Content type not found");
            setViews([]);
            setColumns(FALLBACK_COLUMNS);
          }
          return;
        }

        if (cancelled) return;
        setContentType(ct);

        // 2) Load list views for this type + role
        const lvRes = await api.get(`/api/content-types/${ct.id}/list-views`, {
          params: { role },
        });
        if (cancelled) return;

        const loadedViews = (lvRes.data && lvRes.data.views) || [];
        setViews(loadedViews);

        // 3) Choose active view: URL ?view=… → default → first
        const queryViewSlug = searchParams.get("view");
        let chosen = null;

        if (queryViewSlug) {
          chosen = loadedViews.find((v) => v.slug === queryViewSlug) || null;
        }
        if (!chosen && loadedViews.length) {
          chosen = loadedViews.find((v) => v.is_default) || loadedViews[0];
        }

        if (chosen) {
          setActiveViewSlug(chosen.slug);
          const cfgCols = chosen.config && chosen.config.columns;
          setColumns(
            Array.isArray(cfgCols) && cfgCols.length
              ? cfgCols
              : FALLBACK_COLUMNS
          );
        } else {
          setActiveViewSlug("");
          setColumns(FALLBACK_COLUMNS);
        }
      } catch (err) {
        console.error("[TypeList] failed to load meta/views", err);
        if (!cancelled) {
          setError("Failed to load list views for this content type");
          setViews([]);
          setColumns(FALLBACK_COLUMNS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [typeSlug, role, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // React to view slug changes in the URL after initial load
  useEffect(() => {
    if (!views || !views.length) return;
    const queryViewSlug = searchParams.get("view");
    let chosen = null;

    if (queryViewSlug) {
      chosen = views.find((v) => v.slug === queryViewSlug) || null;
    }
    if (!chosen) {
      chosen = views.find((v) => v.is_default) || views[0] || null;
    }
    if (!chosen) return;

    setActiveViewSlug(chosen.slug);
    const cfgCols = chosen.config && chosen.config.columns;
    setColumns(
      Array.isArray(cfgCols) && cfgCols.length ? cfgCols : FALLBACK_COLUMNS
    );
    setPage(1);
  }, [views, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------
  // Load entries for this type
  // ---------------------------------------------
  useEffect(() => {
    if (!typeSlug) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get(`/api/content/${typeSlug}`);
        if (cancelled) return;

        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.entries || [];
        setEntries(list);
      } catch (err) {
        console.error("[TypeList] failed to load entries", err);
        if (!cancelled) {
          setError("Failed to load entries");
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [typeSlug]);

  // ---------------------------------------------
  // Filtering + pagination
  // ---------------------------------------------
  const filteredEntries = useMemo(() => {
    let list = entries || [];

    if (statusFilter !== "all") {
      list = list.filter(
        (e) =>
          (e.status || "draft").toLowerCase() === statusFilter.toLowerCase()
      );
    }

    const q = (searchTerm || "").trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const title =
          (e.title || e.data?.title || "").toString().toLowerCase();
        const slug = (e.slug || "").toString().toLowerCase();
        return title.includes(q) || slug.includes(q);
      });
    }

    return list;
  }, [entries, statusFilter, searchTerm]);

  const total = filteredEntries.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * perPage;
  const pageEnd = pageStart + perPage;
  const pageRows = filteredEntries.slice(pageStart, pageEnd);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, typeSlug, activeViewSlug]);

  // ---------------------------------------------
  // Handlers
  // ---------------------------------------------
  const handleClickRow = (entryId) => {
    if (!entryId) return;
    navigate(`/content/${typeSlug}/${entryId}`);
  };

  const handleNewEntry = () => {
    navigate(`/content/${typeSlug}/new`);
  };

  const handleDelete = async (entryId, evt) => {
    evt?.stopPropagation();
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    try {
      await api.delete(`/api/content/${typeSlug}/${entryId}`);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      console.error("[TypeList] delete error", err);
      alert("Failed to delete entry: " + (err.message || String(err)));
    }
  };

  const handleSelectView = (slug) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (slug) {
      nextParams.set("view", slug);
    } else {
      nextParams.delete("view");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const labelForColumn = (key) => {
    const col = (columns || []).find((c) => c.key === key);
    return col?.label || key;
  };

  const allColumnKeys = useMemo(
    () => (columns || []).map((c) => c.key),
    [columns]
  );

  // ---------------------------------------------
  // Render
  // ---------------------------------------------
  const titleText =
    contentType?.name || contentType?.slug || typeSlug || "Entries";

  return (
    <div className="su-page">
      <div className="su-page-header">
        <div className="su-breadcrumb">
          <Link to="/content" className="su-breadcrumb-link">
            Content
          </Link>
          <span className="su-breadcrumb-separator">/</span>
          <span className="su-breadcrumb-current">{titleText}</span>
        </div>

        <div className="su-page-header-main">
          <div>
            <h1 className="su-page-title">{titleText}</h1>
            {contentType?.description && (
              <p className="su-page-subtitle">{contentType.description}</p>
            )}
          </div>
          <div className="su-page-header-actions">
            <button
              type="button"
              className="su-btn su-btn-primary"
              onClick={handleNewEntry}
              disabled={!contentType}
            >
              + New {contentType?.name || "entry"}
            </button>
          </div>
        </div>

        {/* Views selector */}
        <div className="su-mt-md">
          {views && views.length > 0 ? (
            <div className="su-chip-row">
              {views.map((v) => (
                <button
                  key={v.slug}
                  type="button"
                  onClick={() => handleSelectView(v.slug)}
                  className={
                    "su-chip" +
                    (v.slug === activeViewSlug ? " su-chip--active" : "")
                  }
                  title={
                    v.is_default
                      ? `${v.label} (default for ${role})`
                      : v.label
                  }
                >
                  {v.label}
                  {v.is_default && (
                    <span className="su-chip-badge">default</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="su-text-xs su-text-muted">
              No list views configured yet. Using a fallback layout.
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="su-toolbar su-mb-md">
        <div className="su-toolbar-left">
          <input
            type="search"
            className="su-input"
            placeholder="Search entries…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="su-input su-ml-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="su-toolbar-right su-text-sm su-text-muted">
          {loading ? "Loading…" : `${total} entr${total === 1 ? "y" : "ies"}`}
        </div>
      </div>

      {error && (
        <div className="su-alert su-alert-danger su-mb-md">{error}</div>
      )}

      <div className="su-card">
        <div className="su-table-wrapper">
          <table className="su-table">
            <thead>
              <tr>
                {allColumnKeys.map((key) => (
                  <th key={key}>{labelForColumn(key)}</th>
                ))}
                <th className="su-table-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && pageRows.length === 0 ? (
                <tr>
                  <td colSpan={allColumnKeys.length + 1}>Loading…</td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={allColumnKeys.length + 1}>
                    No entries yet for this type.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className="su-table-row-clickable"
                    onClick={() => handleClickRow(row.id)}
                  >
                    {allColumnKeys.map((key) => {
                      let raw;
                      if (key === "title") {
                        raw = row.title || row.data?.title || "(untitled)";
                      } else if (key === "slug") {
                        raw = row.slug;
                      } else if (key === "status") {
                        raw = row.status || "draft";
                      } else if (key === "created_at" || key === "updated_at") {
                        raw = formatDate(row[key]);
                      } else {
                        raw = row.data ? row.data[key] : undefined;
                      }
                      return <td key={key}>{renderCellValue(raw)}</td>;
                    })}
                    <td
                      className="su-table-cell-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="su-btn su-btn-xs su-btn-ghost"
                        onClick={() => handleClickRow(row.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="su-btn su-btn-xs su-btn-ghost su-text-danger"
                        onClick={(e) => handleDelete(row.id, e)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="su-pagination">
            <button
              type="button"
              className="su-btn su-btn-sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="su-pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="su-btn su-btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setPage((p) => Math.min(totalPages, p + 1))
              }
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
