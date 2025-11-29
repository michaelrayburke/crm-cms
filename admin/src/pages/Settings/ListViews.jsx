import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

// Simple slugify for view slugs
function slugify(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Built-in columns that exist on every entry
const BUILTIN_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "slug", label: "Slug" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
];

export default function ListViewsSettings() {
  const [contentTypes, setContentTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [role, setRole] = useState("ADMIN");

  const [contentTypeDetail, setContentTypeDetail] = useState(null);

  // All views for this type+role
  const [views, setViews] = useState([]);
  const [activeViewSlug, setActiveViewSlug] = useState("");
  const [currentLabel, setCurrentLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [columns, setColumns] = useState([]);

  const [availableFields, setAvailableFields] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  // ---------------------------------------------
  // Load content types on mount
  // ---------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingTypes(true);
        const res = await api.get("/api/content-types");
        if (cancelled) return;
        const list = res.data || [];

        // predictable sort
        list.sort((a, b) => {
          const an = (a.name || a.slug || "").toLowerCase();
          const bn = (b.name || b.slug || "").toLowerCase();
          return an.localeCompare(bn);
        });

        setContentTypes(list);
        if (list.length && !selectedTypeId) {
          setSelectedTypeId(list[0].slug);
        }
      } catch (err) {
        console.error("[ListViews] failed to load content types", err);
        if (!cancelled) {
          setError("Failed to load content types");
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // run once on mount

  // ---------------------------------------------
  // Build available fields = builtins + CT fields
  // ---------------------------------------------
  const computeAvailableFields = (ct) => {
    if (!ct) return BUILTIN_COLUMNS;
    const ctFields = Array.isArray(ct.fields)
      ? ct.fields.map((f) => ({
          key: f.key, // data.[key] in entries.data
          label: f.label || f.name || f.key,
        }))
      : [];
    const all = [...BUILTIN_COLUMNS];
    for (const f of ctFields) {
      if (!all.find((x) => x.key === f.key)) {
        all.push(f);
      }
    }
    return all;
  };

  // ---------------------------------------------
  // Load views + CT details whenever type/role changes
  // ---------------------------------------------
  useEffect(() => {
    if (!selectedTypeId || !role) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setSaveMessage("");
        setDirty(false);

        const [ctRes, viewsRes] = await Promise.all([
          api.get(`/api/content-types/${selectedTypeId}`),
          api.get(`/api/content-types/${selectedTypeId}/list-views`, {
            params: { role },
          }),
        ]);

        if (cancelled) return;

        const ct = ctRes.data;
        setContentTypeDetail(ct);

        const av = computeAvailableFields(ct);
        setAvailableFields(av);

        // ---- NEW: handle both array & { views: [] } shapes + expose debug ----
        const raw = viewsRes.data;
        let loadedViews = [];

        if (Array.isArray(raw)) {
          loadedViews = raw;
        } else if (raw && Array.isArray(raw.views)) {
          loadedViews = raw.views;
        } else if (raw && typeof raw === "object") {
          console.warn("[ListViews] Unexpected list views shape", raw);
        }

        setViews(loadedViews);

        // global debug helper so we can inspect from DevTools
        window.__debugListViews = {
          typeId: selectedTypeId,
          role,
          raw,
          loadedViews,
        };
        console.log("[ListViews] Loaded list views", window.__debugListViews);
        // ---------------------------------------------------------------------

        if (loadedViews.length === 0) {
          // No views yet: synthesize a default config
          const defaultCols = [
            { key: "title", label: "Title" },
            { key: "status", label: "Status" },
            { key: "updated_at", label: "Updated" },
          ];
          setActiveViewSlug("default");
          setCurrentLabel("Default list");
          setIsDefault(true);
          setColumns(defaultCols);
          setDirty(false);
        } else {
          // Pick default or first view
          const def =
            loadedViews.find((v) => v.is_default) || loadedViews[0];
          setActiveViewSlug(def.slug);
          setCurrentLabel(def.label);
          setIsDefault(!!def.is_default);

          const cfg = (def.config && def.config.columns) || [];
          if (cfg.length) {
            setColumns(cfg);
          } else {
            // fallback if somehow empty
            const defaultCols = [
              { key: "title", label: "Title" },
              { key: "status", label: "Status" },
              { key: "updated_at", label: "Updated" },
            ];
            setColumns(defaultCols);
          }
        }
      } catch (err) {
        console.error("[ListViews] load views error", err);
        if (!cancelled) {
          setError("Failed to load list views");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, role]);

  // ---------------------------------------------
  // Derived: chosen view object
  // ---------------------------------------------
  const activeView = useMemo(() => {
    if (!views || !views.length) return null;
    return views.find((v) => v.slug === activeViewSlug) || null;
  }, [views, activeViewSlug]);

  // ---------------------------------------------
  // Handlers
  // ---------------------------------------------
  const handleSelectType = (e) => {
    setSelectedTypeId(e.target.value);
  };

  const handleSelectRole = (e) => {
    setRole(e.target.value);
  };

  const handleSelectView = (slug) => {
    if (!views || !views.length) return;

    const v = views.find((x) => x.slug === slug);
    if (!v) return;

    setActiveViewSlug(slug);
    setCurrentLabel(v.label);
    setIsDefault(!!v.is_default);

    const cfg = (v.config && v.config.columns) || [];
    if (cfg.length) {
      setColumns(cfg);
    } else {
      const defaultCols = [
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "updated_at", label: "Updated" },
      ];
      setColumns(defaultCols);
    }
    setDirty(false);
    setSaveMessage("");
    setError("");
  };

  const handleNewView = () => {
    const baseLabel = "New view";
    let label = baseLabel;
    let suffix = 1;
    const existingLabels = (views || []).map((v) => v.label.toLowerCase());
    while (existingLabels.includes(label.toLowerCase())) {
      suffix += 1;
      label = `${baseLabel} ${suffix}`;
    }
    const slug = slugify(label);

    setActiveViewSlug(slug);
    setCurrentLabel(label);
    setIsDefault(false);

    if (!columns || !columns.length) {
      const defaultCols = [
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "updated_at", label: "Updated" },
      ];
      setColumns(defaultCols);
    }

    setDirty(true);
    setSaveMessage("");
    setError("");
  };

  const handleLabelChange = (e) => {
    const val = e.target.value;
    setCurrentLabel(val);

    // If we're on a synthetic/default or new view, keep slug in sync
    if (!activeView || activeView.slug === "default") {
      setActiveViewSlug(slugify(val || "view"));
    }

    setDirty(true);
  };

  const handleToggleDefault = (e) => {
    setIsDefault(e.target.checked);
    setDirty(true);
  };

  const handleAddColumn = (fieldKey) => {
    const field = availableFields.find((f) => f.key === fieldKey);
    if (!field) return;
    if (columns.find((c) => c.key === field.key)) return;
    setColumns((prev) => [...prev, { key: field.key, label: field.label }]);
    setDirty(true);
  };

  const handleRemoveColumn = (fieldKey) => {
    setColumns((prev) => prev.filter((c) => c.key !== fieldKey));
    setDirty(true);
  };

  const moveColumn = (fieldKey, direction) => {
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.key === fieldKey);
      if (idx === -1) return prev;
      const next = [...prev];
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedTypeId || !role) return;
    setError("");
    setSaveMessage("");

    const label = (currentLabel || "").trim();
    const slug = slugify(label || "view");

    if (!label) {
      setError("Label is required");
      return;
    }
    if (!columns || !columns.length) {
      setError("Please choose at least one column");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        slug,
        label,
        role,
        is_default: isDefault,
        config: { columns },
      };
      const res = await api.put(
        `/api/content-types/${selectedTypeId}/list-view`,
        payload
      );
      const saved = res.data.view || res.data;

      setViews((prev) => {
        const idx = prev.findIndex((v) => v.slug === saved.slug);
        if (idx === -1) {
          return [...prev, saved];
        }
        const next = [...prev];
        next[idx] = saved;
        return next;
      });

      setActiveViewSlug(saved.slug);
      setIsDefault(!!saved.is_default);
      setSaveMessage("List view saved");
      setDirty(false);
    } catch (err) {
      console.error("[ListViews] save error", err);
      setError("Failed to save list view");
    } finally {
      setLoading(false);
    }
  };

  const availableNotSelected = useMemo(() => {
    if (!availableFields || !availableFields.length) return [];
    const selectedKeys = new Set((columns || []).map((c) => c.key));
    return (availableFields || []).filter((f) => !selectedKeys.has(f.key));
  }, [availableFields, columns]);

  // ---------------------------------------------
  // Render
  // ---------------------------------------------
  return (
    <div className="su-page su-page-settings">
      <div className="su-page-header">
        <h1 className="su-page-title">List Views</h1>
        <p className="su-page-subtitle">
          Control which columns show in entry lists, per content type, role, and
          view.
        </p>
      </div>

      <div className="su-card su-mb-lg">
        <div className="su-card-body su-flex su-gap-md su-flex-wrap">
          <div className="su-field">
            <label className="su-label">Content type</label>
            <select
              className="su-input"
              value={selectedTypeId || ""}
              onChange={handleSelectType}
              disabled={loadingTypes || !contentTypes.length}
            >
              {!contentTypes.length && (
                <option value="">No content types yet</option>
              )}
              {contentTypes.map((ct) => (
                <option key={ct.id} value={ct.slug}>
                  {ct.name || ct.slug}
                </option>
              ))}
            </select>
          </div>

          <div className="su-field">
            <label className="su-label">Role</label>
            <select
              className="su-input"
              value={role}
              onChange={handleSelectRole}
            >
              <option value="ADMIN">Admin</option>
              <option value="EDITOR">Editor</option>
              <option value="AUTHOR">Author</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
        </div>
      </div>

      <div className="su-layout-grid su-grid-cols-3 su-gap-lg su-mb-xl">
        {/* Left column: view selector */}
        <div className="su-card">
          <div className="su-card-header">
            <h2 className="su-card-title">Views for this role</h2>
          </div>
          <div className="su-card-body">
            {views.length === 0 && (
              <p className="su-text-muted">No saved views yet for this role.</p>
            )}
            <div className="su-chip-row su-mb-md">
              {views.map((v) => (
                <button
                  key={v.slug}
                  type="button"
                  onClick={() => handleSelectView(v.slug)}
                  className={
                    "su-chip" +
                    (v.slug === activeViewSlug ? " su-chip--active" : "")
                  }
                >
                  {v.label}
                  {v.is_default && (
                    <span className="su-chip-badge">default</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                className="su-chip su-chip--ghost"
                onClick={handleNewView}
              >
                + New view
              </button>
            </div>

            <div className="su-field">
              <label className="su-label">View label</label>
              <input
                className="su-input"
                value={currentLabel}
                onChange={handleLabelChange}
                placeholder="e.g. All entries"
              />
            </div>
            <div className="su-field su-mt-sm">
              <label className="su-checkbox">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={handleToggleDefault}
                />
                <span>Make this the default view for {role}</span>
              </label>
            </div>

            <div className="su-mt-md su-text-xs su-text-muted">
              <div>
                Slug: <code>{activeViewSlug || "(auto)"}</code>
              </div>
            </div>

            <div className="su-mt-lg">
              <button
                type="button"
                className="su-btn su-btn-primary"
                onClick={handleSave}
                disabled={
                  loading || !selectedTypeId || !role || !columns.length
                }
              >
                {loading ? "Saving…" : "Save view"}
              </button>
              {dirty && (
                <span className="su-text-warning su-ml-sm">
                  Unsaved changes
                </span>
              )}
              {saveMessage && (
                <span className="su-text-success su-ml-sm">
                  {saveMessage}
                </span>
              )}
            </div>

            {error && (
              <div className="su-alert su-alert-danger su-mt-md">{error}</div>
            )}
          </div>
        </div>

        {/* Middle: available fields */}
        <div className="su-card">
          <div className="su-card-header">
            <h2 className="su-card-title">Available fields</h2>
            <p className="su-card-subtitle">
              Click to add a field as a column in this view.
            </p>
          </div>
          <div className="su-card-body su-list-scroll">
            {!contentTypeDetail ? (
              <p className="su-text-muted">
                Choose a content type to see its fields.
              </p>
            ) : availableNotSelected.length === 0 ? (
              <p className="su-text-muted">
                All fields are already in use for this view.
              </p>
            ) : (
              <ul className="su-list">
                {availableNotSelected.map((f) => (
                  <li key={f.key} className="su-list-item">
                    <button
                      type="button"
                      className="su-btn su-btn-ghost su-btn-sm su-w-full su-justify-between"
                      onClick={() => handleAddColumn(f.key)}
                    >
                      <span>{f.label}</span>
                      <code className="su-badge su-badge-soft">{f.key}</code>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: chosen columns */}
        <div className="su-card">
          <div className="su-card-header">
            <h2 className="su-card-title">Visible columns (order)</h2>
            <p className="su-card-subtitle">
              Drag &amp; drop would be nice later; for now use the arrows.
            </p>
          </div>
          <div className="su-card-body su-list-scroll">
            {(!columns || !columns.length) && (
              <p className="su-text-muted">
                No columns selected. Choose some from &ldquo;Available
                fields&rdquo;.
              </p>
            )}
            <ul className="su-list">
              {columns.map((c, idx) => (
                <li
                  key={c.key}
                  className="su-list-item su-flex su-items-center su-gap-sm"
                >
                  <div className="su-flex-1">
                    <div>{c.label}</div>
                    <div className="su-text-xs su-text-muted">
                      <code>{c.key}</code>
                    </div>
                  </div>
                  <div className="su-btn-group">
                    <button
                      type="button"
                      className="su-btn su-btn-icon su-btn-xs"
                      onClick={() => moveColumn(c.key, "up")}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="su-btn su-btn-icon su-btn-xs"
                      onClick={() => moveColumn(c.key, "down")}
                      disabled={idx === columns.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="su-btn su-btn-icon su-btn-xs su-btn-danger"
                      onClick={() => handleRemoveColumn(c.key)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Optional debug */}
      <div className="su-card su-mt-lg">
        <div className="su-card-header">
          <h2 className="su-card-title">Debug JSON</h2>
        </div>
        <div className="su-card-body">
          <pre className="su-code-block">
            {JSON.stringify(
              {
                contentTypeId: selectedTypeId,
                role,
                activeViewSlug,
                label: currentLabel,
                isDefault,
                columns,
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
