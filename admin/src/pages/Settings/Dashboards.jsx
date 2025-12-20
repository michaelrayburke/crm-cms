// admin/src/pages/Settings/Dashboards.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";

const DEFAULT_CONFIG = {
  layout: "two-column", // or "single-column", "three-column" later
  widgets: [
    {
      id: "welcome",
      type: "html",
      title: "Welcome",
      html: "<p>Welcome to your dashboard.</p>",
    },
  ],
};

export default function SettingsDashboardsPage() {
  const [roles, setRoles] = useState([]);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState("");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState(DEFAULT_CONFIG);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Load roles on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRoles(true);
        const data = await api.get("/api/roles");
        if (cancelled) return;
        setRoles(data || []);

        if ((data || []).length && !selectedRoleSlug) {
          // Default to ADMIN if available, else first
          const adminRole =
            (data || []).find((r) => r.slug === "ADMIN") || data[0];
          setSelectedRoleSlug(adminRole.slug);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load roles");
        }
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load config whenever selectedRoleSlug changes
  useEffect(() => {
    if (!selectedRoleSlug) return;
    let cancelled = false;

    (async () => {
      try {
        setError("");
        setSaveMessage("");
        setLoadingConfig(true);

        const data = await api.get(
          `/api/dashboard-configs/${encodeURIComponent(selectedRoleSlug)}`
        );

        const cfg =
          data && typeof data === "object" && data.widgets
            ? data
            : DEFAULT_CONFIG;

        if (cancelled) return;
        setConfig(cfg);
        setOriginalConfig(cfg);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          // If 404, just use default config
          if (err.status === 404) {
            setConfig(DEFAULT_CONFIG);
            setOriginalConfig(DEFAULT_CONFIG);
          } else {
            setError(
              err.message || "Failed to load dashboard configuration for role"
            );
          }
        }
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRoleSlug]);

  const isDirty = JSON.stringify(config) !== JSON.stringify(originalConfig);

  function handleJsonChange(e) {
    const value = e.target.value;
    try {
      const parsed = JSON.parse(value);
      setConfig(parsed);
      setError("");
    } catch {
      // We keep a separate text area; if invalid JSON, we show error but
      // don't immediately break the stored config
      setError("Invalid JSON. Please fix before saving.");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!selectedRoleSlug) return;

    setError("");
    setSaveMessage("");
    setSaving(true);

    try {
      // Ensure the config is a valid object
      if (!config || typeof config !== "object") {
        setError("Dashboard config must be a JSON object.");
        setSaving(false);
        return;
      }

      const saved = await api.put(
        `/api/dashboard-configs/${encodeURIComponent(selectedRoleSlug)}`,
        config
      );

      setOriginalConfig(saved || config);
      setConfig(saved || config);
      setSaveMessage("Dashboard layout saved for this role.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save dashboard configuration");
    } finally {
      setSaving(false);
    }
  }

  // Textarea value
  const jsonValue = (() => {
    try {
      return JSON.stringify(config, null, 2);
    } catch {
      return "";
    }
  })();

  return (
    <div className="su-page su-page--settings">
      <header className="su-page-header">
        <div>
          <h1 className="su-page-title">Dashboards</h1>
          <p className="su-page-subtitle">
            Define which widgets appear on the main dashboard for each role.
            Editors will see the Editor dashboard; Admins will see the Admin
            dashboard, etc.
          </p>
        </div>
      </header>

      {error && (
        <div className="su-alert su-alert--error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {saveMessage && (
        <div className="su-alert su-alert--success" style={{ marginBottom: 16 }}>
          {saveMessage}
        </div>
      )}

      <div className="su-grid cols-2 gap-lg">
        {/* Left: Role selection & help */}
        <section className="su-card">
          <h2 className="su-card-title">Select Role</h2>
          {loadingRoles ? (
            <p className="su-text-muted">Loading roles…</p>
          ) : (
            <>
              <label className="su-field">
                <span className="su-label">Role</span>
                <select
                  className="su-select"
                  value={selectedRoleSlug}
                  onChange={(e) => setSelectedRoleSlug(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.label} ({r.slug})
                    </option>
                  ))}
                </select>
              </label>

              <div className="su-divider" />

              <p className="su-text-small su-text-muted">
                This config is shared by <strong>all users</strong> with this
                role. For example:
              </p>
              <ul className="su-list su-text-small su-text-muted">
                <li>Admins share the Admin dashboard layout.</li>
                <li>Editors share the Editor dashboard layout.</li>
                <li>
                  Later, you can add more roles (e.g. VIEWER, CLIENT) and define
                  dashboards for them too.
                </li>
              </ul>
            </>
          )}
        </section>

        {/* Right: JSON editor */}
        <section className="su-card">
          <div className="su-card-header">
            <h2 className="su-card-title">Dashboard Layout JSON</h2>
            {loadingConfig && (
              <span className="su-badge su-badge--soft">Loading…</span>
            )}
          </div>

          <p className="su-text-small su-text-muted" style={{ marginBottom: 8 }}>
            This JSON defines the widgets for the selected role. You can start
            simple:
          </p>
          <pre className="su-code-block su-text-small" style={{ marginBottom: 12 }}>
{`{
  "layout": "two-column",
  "widgets": [
    { "id": "welcome", "type": "html", "title": "Welcome", "html": "<p>Hello!</p>" },
    { "id": "quicklinks", "type": "quicklinks", "title": "Quick Links", "links": [...] }
  ]
}`}
          </pre>

          <form onSubmit={handleSave} className="su-stack-md">
            <label className="su-field">
              <span className="su-label">Config JSON</span>
              <textarea
                className="su-textarea su-font-mono"
                rows={18}
                value={jsonValue}
                onChange={handleJsonChange}
                spellCheck={false}
              />
            </label>

            <div className="su-flex su-flex-gap-sm su-flex-align-center">
              <button
                type="submit"
                className="su-btn primary"
                disabled={saving || !isDirty || !!error}
              >
                {saving ? "Saving…" : "Save dashboard for this role"}
              </button>
              {isDirty && !saving && !error && (
                <span className="su-text-small su-text-muted">
                  You have unsaved changes.
                </span>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
