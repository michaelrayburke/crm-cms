import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";

function prettyJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "{}";
  }
}

function parseJson(str) {
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("JSON must be an object");
    }
    return parsed;
  } catch (err) {
    throw new Error(err.message || "Invalid JSON");
  }
}

// Build builderFields from content type + an optional config
function buildBuilderFromTypeAndConfig(contentType, config) {
  if (!contentType || !Array.isArray(contentType.fields)) return [];

  const fields = contentType.fields;
  const section = config?.sections?.[0];
  const cfgFields = Array.isArray(section?.fields) ? section.fields : [];

  const orderMap = new Map();
  cfgFields.forEach((f, idx) => {
    if (f?.key) orderMap.set(f.key, idx);
  });

  const builder = fields.map((f, idx) => {
    const key = f.key;
    const inConfig = orderMap.has(key);
    const order = inConfig ? orderMap.get(key) : cfgFields.length + idx;
    return {
      key,
      label: f.label || f.name || f.key,
      visible: inConfig || cfgFields.length === 0, // if no config, all visible
      order,
    };
  });

  return builder.sort((a, b) => a.order - b.order);
}

export default function EntryViews() {
  const [contentTypes, setContentTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  const [role, setRole] = useState("ADMIN");

  const [views, setViews] = useState([]); // list of views for this type+role
  const [activeSlug, setActiveSlug] = useState(null);

  const activeView = views.find((v) => v.slug === activeSlug) || null;

  const [configText, setConfigText] = useState("{}");
  const [originalConfigText, setOriginalConfigText] = useState("{}");
  const [builderFields, setBuilderFields] = useState([]);

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const dirty = configText !== originalConfigText;

  // ------------------------------------------------------------
  // Load content types list
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTypes(true);
      setError("");
      try {
        const res = await api.get("/api/content-types");
        const list = Array.isArray(res) ? res : res?.data || [];
        if (!cancelled) {
          setContentTypes(list);
          if (list.length && !selectedTypeId) {
            setSelectedTypeId(list[0].slug);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load content types");
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Load full content type + all views for role
  // ------------------------------------------------------------
  useEffect(() => {
    if (!selectedTypeId || !role) return;
    let cancelled = false;

    (async () => {
      setLoadingConfig(true);
      setError("");
      setSaveMessage("");

      try {
        // 1) Full content type with fields
        const ctRes = await api.get(`/api/content-types/${selectedTypeId}`);
        const ct = ctRes?.data || ctRes || null;
        if (!cancelled) {
          setSelectedType(ct);
        }

        // 2) All editor views for this type + role
        const viewsRes = await api.get(
          `/api/content-types/${selectedTypeId}/editor-views?role=${encodeURIComponent(
            role
          )}`
        );
        const list = Array.isArray(viewsRes?.views)
          ? viewsRes.views
          : Array.isArray(viewsRes)
          ? viewsRes
          : [];

        if (!cancelled) {
          setViews(list);

          let initialView = null;
          if (list.length) {
            initialView =
              list.find((v) => v.is_default) !== undefined
                ? list.find((v) => v.is_default)
                : list[0];
          }

          if (initialView) {
            setActiveSlug(initialView.slug);
            const text = prettyJson(initialView.config || {});
            setConfigText(text);
            setOriginalConfigText(text);
            setBuilderFields(
              buildBuilderFromTypeAndConfig(ct, initialView.config || {})
            );
          } else {
            // No saved views yet: show empty config and all fields in order
            setActiveSlug("default");
            const emptyCfg = {};
            const text = prettyJson(emptyCfg);
            setConfigText(text);
            setOriginalConfigText(text);
            setBuilderFields(buildBuilderFromTypeAndConfig(ct, emptyCfg));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load editor views");
          // Fallback: no views, but we can still show fields
          setViews([]);
          setActiveSlug("default");
          const emptyCfg = {};
          const text = prettyJson(emptyCfg);
          setConfigText(text);
          setOriginalConfigText(text);
          setBuilderFields(buildBuilderFromTypeAndConfig(selectedType, emptyCfg));
        }
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, role]);

  // ------------------------------------------------------------
  // Sync config JSON from visual builder
  // ------------------------------------------------------------
  function syncConfigFromBuilder(nextBuilderFields) {
    const visible = nextBuilderFields
      .filter((f) => f.visible)
      .sort((a, b) => a.order - b.order);

    const section = {
      id: "main",
      title: "Fields",
      columns: 1,
      fields: visible.map((f) => ({
        key: f.key,
        width: 1,
        visible: true,
      })),
    };

    const cfg = { sections: [section] };
    const text = prettyJson(cfg);
    setConfigText(text);
  }

  // ------------------------------------------------------------
  // Visual builder interactions
  // ------------------------------------------------------------
  function handleToggleVisible(index) {
    setBuilderFields((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], visible: !copy[index].visible };
      syncConfigFromBuilder(copy);
      return copy;
    });
  }

  function handleMove(index, direction) {
    setBuilderFields((prev) => {
      const copy = [...prev];
      const target = index + direction;
      if (target < 0 || target >= copy.length) return prev;

      const tmp = copy[index];
      copy[index] = copy[target];
      copy[target] = tmp;

      const withOrder = copy.map((f, idx) => ({ ...f, order: idx }));
      syncConfigFromBuilder(withOrder);
      return withOrder;
    });
  }

  // ------------------------------------------------------------
  // Handle switching between views
  // ------------------------------------------------------------
  function handleSelectView(slug) {
    const view = views.find((v) => v.slug === slug);
    setActiveSlug(slug);
    if (view) {
      const text = prettyJson(view.config || {});
      setConfigText(text);
      setOriginalConfigText(text);
      setBuilderFields(
        buildBuilderFromTypeAndConfig(selectedType, view.config || {})
      );
    } else {
      // If it's a synthetic "default" with no row yet
      const emptyCfg = {};
      const text = prettyJson(emptyCfg);
      setConfigText(text);
      setOriginalConfigText(text);
      setBuilderFields(buildBuilderFromTypeAndConfig(selectedType, emptyCfg));
    }
  }

  // ------------------------------------------------------------
  // Create a new named view
  // ------------------------------------------------------------
  async function handleNewView() {
    if (!selectedTypeId) return;
    const label = window.prompt(
      "Name for this view (e.g. SEO details, Minimal editor):"
    );
    if (!label) return;

    // Simple slugify
    const baseSlug = label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-_]/g, "")
      .replace(/\s+/g, "-");
    let slug = baseSlug || "view";

    // Ensure uniqueness client-side (SERVER WILL VALIDATE TOO)
    const existingSlugs = new Set(views.map((v) => v.slug));
    let i = 2;
    while (existingSlugs.has(slug)) {
      slug = `${baseSlug || "view"}-${i++}`;
    }

    let cfg;
    try {
      cfg = parseJson(configText);
    } catch {
      cfg = {};
    }

    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await api.put(
        `/api/content-types/${selectedTypeId}/editor-view`,
        {
          slug,
          label,
          role,
          is_default: false,
          config: cfg,
        }
      );
      const saved = res?.view || res;

      const nextViews = [...views, saved];
      setViews(nextViews);
      setActiveSlug(saved.slug);
      setOriginalConfigText(prettyJson(saved.config || {}));
      setSaveMessage("New view created.");
    } catch (err) {
      setError(err.message || "Failed to create view");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------
  // Mark active view as default
  // ------------------------------------------------------------
  async function handleMakeDefault() {
    if (!selectedTypeId || !activeView) return;

    let cfg;
    try {
      cfg = parseJson(configText);
    } catch (err) {
      setError(err.message);
      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await api.put(
        `/api/content-types/${selectedTypeId}/editor-view`,
        {
          slug: activeView.slug,
          label: activeView.label,
          role,
          is_default: true,
          config: cfg,
        }
      );
      const saved = res?.view || res;

      const nextViews = views.map((v) =>
        v.slug === saved.slug
          ? { ...v, ...saved }
          : { ...v, is_default: false }
      );
      setViews(nextViews);
      setOriginalConfigText(prettyJson(saved.config || {}));
      setSaveMessage("Set as default editor view for this role.");
    } catch (err) {
      setError(err.message || "Failed to update default view");
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------
  // Save JSON config for active view
  // ------------------------------------------------------------
  async function handleSave(e) {
    e.preventDefault();
    if (!selectedTypeId || !activeSlug) return;

    setError("");
    setSaveMessage("");
    let parsed;
    try {
      parsed = parseJson(configText);
    } catch (err) {
      setError(err.message);
      return;
    }

    const base = activeView || {
      slug: activeSlug,
      label: "Default editor",
      role,
      is_default: false,
      config: {},
    };

    setSaving(true);
    try {
      const res = await api.put(
        `/api/content-types/${selectedTypeId}/editor-view`,
        {
          slug: base.slug,
          label: base.label,
          role,
          is_default: base.is_default,
          config: parsed,
        }
      );
      const saved = res?.view || res;

      const nextViews = [
        ...views.filter((v) => v.slug !== saved.slug),
        saved,
      ];
      setViews(nextViews);
      setOriginalConfigText(configText);
      setSaveMessage("Editor view saved.");
    } catch (err) {
      setError(err.message || "Failed to save editor view");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="su-page">
      <h1 className="su-page-title">Entry Editor Views</h1>
      <p className="su-page-intro">
        Define how the entry editor layout looks for each content type and role.
        If no view is defined, the editor will automatically show all fields.
      </p>

      {error && (
        <div className="su-alert su-alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {saveMessage && (
        <div className="su-alert su-alert-success" style={{ marginBottom: 16 }}>
          {saveMessage}
        </div>
      )}

      <div className="su-two-column">
        {/* LEFT: type + role selection */}
        <div className="su-card">
          <h2 className="su-card-title">Select Content Type</h2>
          {loadingTypes ? (
            <p>Loading content types…</p>
          ) : !contentTypes.length ? (
            <p>No content types found. Create one in QuickBuilder first.</p>
          ) : (
            <div className="su-vertical-list">
              {contentTypes.map((ct) => (
                <button
                  key={ct.slug}
                  type="button"
                  className={
                    "su-pill-button" +
                    (ct.slug === selectedTypeId ? " su-pill-button--active" : "")
                  }
                  onClick={() => setSelectedTypeId(ct.slug)}
                >
                  {ct.name || ct.slug}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <label className="su-label">Role</label>
            <select
              className="su-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="ADMIN">Admin</option>
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>

          {/* View chips */}
          <div style={{ marginTop: 24 }}>
            <label className="su-label">Views for this role</label>
            <div className="su-vertical-list" style={{ gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {views.map((v) => (
                  <button
                    key={v.slug}
                    type="button"
                    className={
                      "su-pill-button" +
                      (v.slug === activeSlug ? " su-pill-button--active" : "")
                    }
                    onClick={() => handleSelectView(v.slug)}
                  >
                    {v.label}
                    {v.is_default ? " ⭐" : ""}
                  </button>
                ))}
                <button
                  type="button"
                  className="su-pill-button su-pill-button--ghost"
                  onClick={handleNewView}
                >
                  + New view
                </button>
              </div>
              {activeView && !activeView.is_default && (
                <button
                  type="button"
                  className="su-button su-button-secondary small"
                  style={{ marginTop: 8 }}
                  onClick={handleMakeDefault}
                  disabled={saving}
                >
                  Make “{activeView.label}” default for {role}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: visual builder + JSON */}
        <div className="su-card">
          <h2 className="su-card-title">
            Editor Layout{" "}
            {activeView ? (
              <span style={{ fontSize: 13, opacity: 0.8 }}>
                – {activeView.label}
              </span>
            ) : null}
          </h2>
          <p className="su-help-text">
            Use the visual layout to choose and order fields, or edit the JSON
            directly for advanced layouts.
          </p>

          {/* Visual builder */}
          {selectedType && Array.isArray(selectedType.fields) && (
            <div
              style={{
                marginBottom: 16,
                border: "1px solid var(--su-border)",
                borderRadius: 10,
                padding: 10,
                background: "var(--su-surface-muted, #f9fafb)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <strong style={{ fontSize: 13 }}>Visual layout</strong>
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  Check to show; use arrows to reorder.
                </span>
              </div>

              {builderFields.length === 0 && (
                <p style={{ fontSize: 12, opacity: 0.7 }}>
                  No fields defined for this content type yet.
                </p>
              )}

              {builderFields.map((f, idx) => (
                <div
                  key={f.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    gap: 8,
                    alignItems: "center",
                    padding: "2px 0",
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={f.visible}
                    onChange={() => handleToggleVisible(idx)}
                  />
                  <span>{f.label}</span>
                  <button
                    type="button"
                    className="su-btn small"
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="su-btn small"
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === builderFields.length - 1}
                  >
                    ↓
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* JSON editor */}
          {loadingConfig ? (
            <p>Loading views…</p>
          ) : (
            <>
              <h3 className="su-card-subtitle" style={{ marginTop: 8 }}>
                Editor Layout JSON
              </h3>
              <textarea
                className="su-input su-input--monospace"
                style={{ minHeight: 260 }}
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
              />

              <div
                className="su-actions-row"
                style={{ marginTop: 12, justifyContent: "space-between" }}
              >
                <button
                  type="button"
                  className="su-button su-button-secondary"
                  disabled={!dirty || saving}
                  onClick={() => setConfigText(originalConfigText)}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="su-button"
                  disabled={!dirty || saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save editor view"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
