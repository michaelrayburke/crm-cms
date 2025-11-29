
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../../lib/api";

/**
 * Content Type Entries page (slug-based)
 *
 * Loads:
 *  - content type meta
 *  - entries for the type
 *  - list views for the type + role
 *
 * It is tolerant to different API response shapes for list views:
 *   - [ { ...view } ]
 *   - { views: [ ... ] }
 *   - { anything: [ ... ] }  // falls back to the first array property
 */
export default function TypeList() {
  const { typeSlug } = useParams();
  const [entries, setEntries] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [debugState, setDebugState] = useState({});
  const [contentType, setContentType] = useState(null);

  // For now we assume ADMIN; if your auth system exposes a role,
  // you can wire that in here.
  const role = "ADMIN";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        // Load content type, entries, and list views in parallel.
        const [ctRes, entriesRes, viewsRes] = await Promise.all([
          api.get(`/api/content-types/${typeSlug}`),
          api.get(`/api/content/${typeSlug}`),
          api.get(`/api/content-types/${typeSlug}/list-views`, {
            params: { role },
          }),
        ]);

        const ctData = ctRes?.data ?? ctRes;
        const entryData = entriesRes?.data ?? entriesRes ?? [];

        // --- Normalize list views result shape -----------------------------
        const viewsRaw = viewsRes?.data ?? viewsRes ?? [];
        let listViews = [];

        if (Array.isArray(viewsRaw)) {
          listViews = viewsRaw;
        } else if (viewsRaw && typeof viewsRaw === "object") {
          if (Array.isArray(viewsRaw.views)) {
            listViews = viewsRaw.views;
          } else {
            const arrayKey = Object.keys(viewsRaw).find((k) =>
              Array.isArray(viewsRaw[k])
            );
            if (arrayKey) {
              listViews = viewsRaw[arrayKey];
            }
          }
        }

        const listViewsCount = Array.isArray(listViews) ? listViews.length : 0;

        // --- Determine active view + columns -------------------------------
        let activeViewSlug = "";
        let activeViewLabel = "";
        let derivedColumns = [];

        if (listViewsCount > 0) {
          const activeView =
            listViews.find((v) => v.is_default) || listViews[0];

          if (activeView) {
            activeViewSlug = activeView.slug || "";
            activeViewLabel = activeView.label || "";

            if (
              activeView.config &&
              Array.isArray(activeView.config.columns) &&
              activeView.config.columns.length
            ) {
              derivedColumns = activeView.config.columns.map((c) => {
                if (typeof c === "string") return c;
                return c.key || c.field_key || c.label || "";
              });
              derivedColumns = derivedColumns.filter(Boolean);
            }
          }
        }

        // Fallback: infer columns from first entry if no configured columns.
        if (!derivedColumns || derivedColumns.length === 0) {
          const first = entryData[0] || {};
          derivedColumns = Object.keys(first);
        }

        if (!cancelled) {
          setContentType(ctData || null);
          setEntries(Array.isArray(entryData) ? entryData : []);
          setColumns(derivedColumns);

          setDebugState({
            typeSlug,
            role,
            hasContentType: !!ctData,
            listViewsCount,
            activeViewSlug,
            activeViewLabel,
            columns: derivedColumns,
            entriesCount: Array.isArray(entryData) ? entryData.length : 0,
            availableKeys: derivedColumns,
            titleKey: "title",
          });
        }
      } catch (err) {
        console.error("[TypeList] Failed to load content type entries", err);
        if (!cancelled) {
          setError(err.message || "Failed to load entries");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (typeSlug) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [typeSlug, role]);

  const title =
    contentType?.label_plural ||
    contentType?.label_singular ||
    contentType?.name ||
    typeSlug;

  if (loading) {
    return (
      <div className="su-page">
        <h2>{title}</h2>
        <p>Loading entries…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="su-page">
        <h2>{title}</h2>
        <div className="su-alert su-alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="su-page">
      <div className="su-page-header">
        <div>
          <h2>{title}</h2>
          <p>Manage entries for this content type.</p>
        </div>
        <div className="su-page-header-actions">
          <Link className="su-btn su-btn-primary" to={`/admin/content/${typeSlug}/new`}>
            + New entry
          </Link>
        </div>
      </div>

      {debugState.listViewsCount === 0 && (
        <div className="su-alert su-alert-info" style={{ marginBottom: 16 }}>
          No list views configured yet for role {role}. Using a fallback layout.
          You can customize columns in <strong>Settings → List Views</strong>.
        </div>
      )}

      <div className="su-card" style={{ marginBottom: 24 }}>
        <table className="su-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr key={entry.id || idx}>
                {columns.map((col) => (
                  <td key={col}>
                    {entry[col] == null || entry[col] === ""
                      ? "—"
                      : String(entry[col])}
                  </td>
                ))}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={columns.length || 1} style={{ textAlign: "center" }}>
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="su-card">
        <h3>Debug</h3>
        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(debugState, null, 2)}
        </pre>
      </div>
    </div>
  );
}
