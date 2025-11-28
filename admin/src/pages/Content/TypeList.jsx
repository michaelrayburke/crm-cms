// FILE: ServiceUp/admin/src/pages/Content/TypeList.jsx
console.log("🔥 TypeList.jsx is running and loaded");

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

  const [role] = useState("ADMIN"); // to be replaced with real auth later
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 25;

  // ---------------------------------------------------------
  // Load CT + List Views (FIXED: uses ct.id for list-views)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!typeSlug) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setViews([]);
        setColumns(FALLBACK_COLUMNS);

        // 1) Get all content types
        const ctRes = await api.get("/api/content-types");
        if (cancelled) return;

        const list = ctRes.data || [];
        const ct =
          list.find((c) => c.slug === typeSlug) ||
          list.find((c) => c.id === typeSlug) ||
          null;

        if (!ct) {
          setContentType(null);
          setError("Content type not found");
          return;
        }

        setContentType(ct);

        // 2) FIXED: always use ct.id
        const lvRes = await api.get(`/api/content-types/${ct.id}/list-views`, {
          params: { role },
        });
        if (cancelled) return;

        const loadedViews = (lvRes.data && lvRes.data.views) || [];
        setViews(loadedViews);

        // Select default / query view
        const queryView = searchParams.get("view");
        let chosen =
          (queryView && loadedViews.find((v) => v.slug === queryView)) ||
          loadedViews.find((v) => v.is_default) ||
          loadedViews[0] ||
          null;

        if (chosen) {
          setActiveViewSlug(chosen.slug);
          setColumns(chosen.config?.columns?.length ? chosen.config.columns : FALLBACK_COLUMNS);
        } else {
          setActiveViewSlug("");
          setColumns(FALLBACK_COLUMNS);
        }
      } catch (err) {
        console.error("[TypeList] meta/views error", err);
        if (!cancelled) {
          setError("Failed to load list views for this content type");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [typeSlug, role, searchParams]);

  // React when URL ?view= changes
  useEffect(() => {
    if (!views.length) return;
    const q = searchParams.get("view");

    let chosen =
      (q && views.find((v) => v.slug === q)) ||
      views.find((v) => v.is_default) ||
      views[0] ||
      null;

    if (!chosen) return;

    setActiveViewSlug(chosen.slug);
    setColumns(chosen.config?.columns?.length ? chosen.config.columns : FALLBACK_COLUMNS);
    setPage(1);
  }, [views, searchParams]);

  // ---------------------------------------------------------
  // Load entries
  // ---------------------------------------------------------
  useEffect(() => {
    if (!typeSlug) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/content/${typeSlug}`);
        if (cancelled) return;

        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.entries || [];

        setEntries(list);
      } catch (err) {
        console.error("[TypeList] load entries error", err);
        if (!cancelled) setError("Failed to load entries");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => (cancelled = true);
  }, [typeSlug]);

  // ---------------------------------------------------------
  // Filtering + paging
  // ---------------------------------------------------------
  const filteredEntries = useMemo(() => {
    let list = [...(entries || [])];

    if (statusFilter !== "all") {
      list = list.filter(
        (e) => (e.status || "draft").toLowerCase() === statusFilter.toLowerCase()
      );
    }

    const q = searchTerm.toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const t = (e.title || e.data?.title || "").toLowerCase();
        const s = (e.slug || "").toLowerCase();
        return t.includes(q) || s.includes(q);
      });
    }

    return list;
  }, [entries, statusFilter, searchTerm]);

  const total = filteredEntries.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredEntries.slice((currentPage - 1) * perPage, currentPage * perPage);

  // ---------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------
  const handleNewEntry = () => navigate(`/content/${typeSlug}/new`);
  const handleClickRow = (id) => navigate(`/content/${typeSlug}/${id}`);

  const handleDelete = async (id, evt) => {
    evt.stopPropagation();
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api.delete(`/api/content/${typeSlug}/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert("Failed to delete entry");
    }
  };

  const handleSelectView = (slug) => {
    const next = new URLSearchParams(searchParams.toString());
    if (slug) next.set("view", slug);
    else next.delete("view");
    setSearchParams(next, { replace: true });
  };

  const labelForColumn = (key) => {
    const col = (columns || []).find((c) => c.key === key);
    return col?.label || key;
  };

  const columnKeys = useMemo(() => (columns || []).map((c) => c.key), [columns]);

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  const titleText = contentType?.name || contentType?.slug || typeSlug;

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
          </div>
          <div>
            <button className="su-btn su-btn-primary" onClick={handleNewEntry}>
              + New {contentType?.name || "entry"}
            </button>
          </div>
        </div>

        {/* Views */}
        <div className="su-mt-md">
          {views.length ? (
            <div className="su-chip-row">
              {views.map((v) => (
                <button
                  key={v.slug}
                  type="button"
                  onClick={() => handleSelectView(v.slug)}
                  className={
                    "su-chip" + (v.slug === activeViewSlug ? " su-chip--active" : "")
                  }
                >
                  {v.label}
                  {v.is_default && <span className="su-chip-badge">default</span>}
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

      {error && <div className="su-alert su-alert-danger su-mb-md">{error}</div>}

      {/* Table */}
      <div className="su-card">
        <div className="su-table-wrapper">
          <table className="su-table">
            <thead>
              <tr>
                {columnKeys.map((key) => (
                  <th key={key}>{labelForColumn(key)}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={columnKeys.length + 1}>Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={columnKeys.length + 1}>No entries yet.</td></tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id} onClick={() => handleClickRow(row.id)} className="su-table-row-clickable">
                    {columnKeys.map((key) => {
                      let val =
                        key === "title"
                          ? row.title || row.data?.title || "(untitled)"
                          : key === "slug"
                          ? row.slug
                          : key === "status"
                          ? row.status
                          : key === "created_at" || key === "updated_at"
                          ? formatDate(row[key])
                          : row.data?.[key];

                      return <td key={key}>{renderCellValue(val)}</td>;
                    })}

                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="su-btn su-btn-xs su-btn-ghost"
                        onClick={() => handleClickRow(row.id)}
                      >
                        Edit
                      </button>
                      <button
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="su-pagination">
          <button
            className="su-btn su-btn-sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((n) => Math.max(1, n - 1))}
          >
            Previous
          </button>

          <span className="su-pagination-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="su-btn su-btn-sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
