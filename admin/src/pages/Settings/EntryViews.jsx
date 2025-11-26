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

export default function EntryViews() {
  const [contentTypes, setContentTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  const [role, setRole] = useState("ADMIN");

  const [viewMeta, setViewMeta] = useState(null);
  const [configText, setConfigText] = useState("{}");
  const [originalConfigText, setOriginalConfigText] = useState("{}");

  const [builderFields, setBuilderFields] = useState([]); // visual layout

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const dirty = configText !== originalConfigText;

  // ------------------------------------------------------------
  // Load content types (basic list)
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
            setSelectedTypeId(list[0].id);
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
  // Helper: regenerate config JSON from builderFields
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
  // Helper: initialize builderFields from selectedType (all fields)
  // ------------------------------------------------------------
  function initBuilderFromType(ct) {
    if (!ct || !Array.isArray(ct.fields)) {
      setBuilderFields([]);
      return;
    }
    const initial = ct.fields.map((f, idx) => ({
      key: f.key,
      label: f.label || f.name || f.key,
      visible: true,
      order: idx,
    }));
    setBuilderFields(initial);
    // don't immediately override JSON from server; we only sync
    // when user starts changing visual layout
  }

  // ------------------------------------------------------------
  // Load full content type + current view config when
  // selectedTypeId or role changes
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
          initBuilderFromType(ct);
        }

        // 2) Editor view config for this type + role
        const viewRes = await api.get(
          `/api/content-types/${selectedTypeId}/editor-view?role=${encodeURIComponent(
            role
          )}`
        );

        const cfg = viewRes?.config || {};
        const meta = {
          slug: viewRes?.slug || "default",
          label: viewRes?.label || "Default editor",
          role: viewRes?.role || role,
        };

        if (!cancelled) {
          const text = prettyJson(cfg);
          setViewMeta(meta);
          setConfigText(text);
          setOriginalConfigText(text);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load editor view");
          setViewMeta({
            slug: "default",
            label: "Default editor",
            role,
          });
          setConfigText("{}");
          setOriginalConfigText("{}");
          initBuilderFromType(selectedType);
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

      // recompute order
      const withOrder = copy.map((f, idx) => ({ ...f, order: idx }));
      syncConfigFromBuilder(withOrder);
      return withOrder;
    });
  }

  // ------------------------------------------------------------
  // Save JSON config
  // ------------------------------------------------------------
  async function handleSave(e) {
    e.preventDefault();
    if (!selectedTypeId || !viewMeta) return;

    setError("");
    setSaveMessage("");
    let parsed;
    try {
      parsed = parseJson(configText);
    } catch (err) {
      setError(err.message);
      return;
    }

    setSaving(true);
    try {
      await api.put(`/api/content-types/${selectedTypeId}/editor-view`, {
        slug: viewMeta.slug || "default",
        label: viewMeta.label || "Default editor",
        role,
        config: parsed,
      });
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
                  key={ct.id}
                  type="button"
                  className={
                    "su-pill-button" +
                    (ct.id === selectedTypeId ? " su-pill-button--active" : "")
                  }
                  onClick={() => setSelectedTypeId(ct.id)}
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
        </div>

        {/* RIGHT: visual builder + JSON */}
        <div className="su-card">
          <h2 className="su-card-title">Editor Layout</h2>
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
            <p>Loading view…</p>
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
