// admin/src/pages/Settings/EntryViews.jsx
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
  const [role, setRole] = useState("ADMIN");

  const [viewMeta, setViewMeta] = useState(null); // slug, label, role
  const [configText, setConfigText] = useState("{}");
  const [originalConfigText, setOriginalConfigText] = useState("{}");

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Load content types
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTypes(true);
      setError("");
      try {
        const res = await api.get("/content-types");
        if (!cancelled) {
          setContentTypes(res || []);
          if (res && res.length && !selectedTypeId) {
            setSelectedTypeId(res[0].id);
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

  // Load view for selected type + role
  useEffect(() => {
    if (!selectedTypeId || !role) return;
    let cancelled = false;
    (async () => {
      setLoadingConfig(true);
      setError("");
      setSaveMessage("");
      try {
        const res = await api.get(
          `/content-types/${selectedTypeId}/editor-view?role=${encodeURIComponent(
            role
          )}`
        );

        const cfg = res?.config || {};
        const meta = {
          slug: res?.slug || "default",
          label: res?.label || "Default editor",
          role: res?.role || role,
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
        }
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, role]);

  const dirty = configText !== originalConfigText;

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
      await api.put(`/content-types/${selectedTypeId}/editor-view`, {
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
        {/* Left: content type + role selector */}
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

        {/* Right: JSON editor */}
        <div className="su-card">
          <h2 className="su-card-title">Editor Layout JSON</h2>
          <p className="su-help-text">
            This JSON controls the sections and fields in the entry editor for
            the selected content type and role.
          </p>

          {loadingConfig ? (
            <p>Loading view…</p>
          ) : (
            <>
              <textarea
                className="su-input su-input--monospace"
                style={{ minHeight: 360 }}
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
