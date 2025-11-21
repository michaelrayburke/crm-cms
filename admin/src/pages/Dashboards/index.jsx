// admin/src/pages/Dashboard/index.jsx
import React, { useMemo, useState } from "react";
import { useDashboard, DEFAULT_WIDGETS } from "../../hooks/useDashboard";

// Basic list of widget types available in the builder
const AVAILABLE_WIDGETS = [
  { type: "welcome", label: "Welcome Hero" },
  { type: "quick-links", label: "Quick Links" },
  { type: "activity", label: "Recent Activity" },
];

// Simple ID helper
function makeId(prefix = "w") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// How each widget actually renders
function WidgetRenderer({ widget }) {
  switch (widget.type) {
    case "welcome":
      return (
        <div className="su-widget su-widget--welcome">
          <h2>{widget.title || "Welcome to ServiceUp"}</h2>
          {widget.subtitle && <p>{widget.subtitle}</p>}
          <p className="su-widget-subtext">
            Build content types, manage entries, and customize your admin UI.
          </p>
        </div>
      );

    case "quick-links":
      return (
        <div className="su-widget su-widget--quick-links">
          <h3>{widget.title || "Quick Actions"}</h3>
          <ul className="su-widget-links">
            {(widget.links || []).map((link) => (
              <li key={link.href || link.label}>
                <a href={link.href || "#"}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
      );

    case "activity":
      return (
        <div className="su-widget su-widget--activity">
          <h3>{widget.title || "Recent Activity"}</h3>
          <p className="su-muted">
            Activity feed coming soon. For now, use this space for updates,
            notes, or stats.
          </p>
        </div>
      );

    default:
      return (
        <div className="su-widget">
          <h3>{widget.title || "Custom widget"}</h3>
          <p className="su-muted">Unknown widget type: {widget.type}</p>
        </div>
      );
  }
}

export default function DashboardPage() {
  // For now, hard-code ADMIN. Later we can read this from your auth context.
  const role = "ADMIN";

  const {
    widgets,
    saveLayout,
    loading,
    saving,
    error,
  } = useDashboard(role);

  const [isEditing, setIsEditing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [addType, setAddType] = useState(AVAILABLE_WIDGETS[0]?.type || "welcome");

  const handleToggleEdit = () => {
    setIsEditing((prev) => !prev);
  };

  const handleAddWidget = async () => {
    const template = AVAILABLE_WIDGETS.find((w) => w.type === addType);
    if (!template) return;

    const newWidget = {
      id: makeId(template.type),
      type: template.type,
      title: template.label,
    };

    const next = [...widgets, newWidget];
    await saveLayout(next);
    setLastSavedAt(new Date());
  };

  const handleRemoveWidget = async (id) => {
    const next = widgets.filter((w) => w.id !== id);
    await saveLayout(next);
    setLastSavedAt(new Date());
  };

  const handleMove = async (index, direction) => {
    const next = [...widgets];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    await saveLayout(next);
    setLastSavedAt(new Date());
  };

  const handleReset = async () => {
    await saveLayout(DEFAULT_WIDGETS);
    setLastSavedAt(new Date());
  };

  const hasWidgets = widgets && widgets.length > 0;

  const statusText = useMemo(() => {
    if (saving) return "Saving…";
    if (lastSavedAt) return `Saved at ${lastSavedAt.toLocaleTimeString()}`;
    if (loading) return "Loading…";
    return "";
  }, [saving, loading, lastSavedAt]);

  return (
    <div className="su-page su-page--dashboard">
      <div className="su-page-header">
        <div>
          <h1 className="su-page-title">Dashboard</h1>
          <p className="su-page-subtitle">
            Overview of your workspace. Customize what you see first.
          </p>
        </div>
        <div className="su-page-header-actions">
          <button
            type="button"
            className="su-btn su-btn-secondary"
            onClick={handleToggleEdit}
          >
            {isEditing ? "Done" : "Customize"}
          </button>
          {isEditing && (
            <button
              type="button"
              className="su-btn su-btn-ghost"
              onClick={handleReset}
            >
              Reset to default
            </button>
          )}
        </div>
      </div>

      {statusText && (
        <div className="su-status-text">
          <span>{statusText}</span>
        </div>
      )}

      {error && (
        <div className="su-alert su-alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div
        className={`su-dashboard-grid ${
          isEditing ? "su-dashboard-grid--editing" : ""
        }`}
      >
        {hasWidgets ? (
          widgets.map((widget, index) => (
            <div key={widget.id || index} className="su-dashboard-widget-card">
              {isEditing && (
                <div className="su-dashboard-widget-toolbar">
                  <span className="su-dashboard-widget-label">
                    {widget.type}
                  </span>
                  <div className="su-dashboard-widget-actions">
                    <button
                      type="button"
                      className="su-icon-btn"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="su-icon-btn"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === widgets.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="su-icon-btn su-icon-btn-danger"
                      onClick={() => handleRemoveWidget(widget.id)}
                      title="Remove widget"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <WidgetRenderer widget={widget} />
            </div>
          ))
        ) : (
          <div className="su-dashboard-empty">
            <p>No widgets yet.</p>
            <p className="su-muted">
              Click <strong>Customize</strong> to add your first widgets.
            </p>
          </div>
        )}

        {isEditing && (
          <div className="su-dashboard-add-card">
            <label className="su-input-label" htmlFor="add-widget-type">
              Add widget
            </label>
            <div className="su-dashboard-add-controls">
              <select
                id="add-widget-type"
                className="su-input"
                value={addType}
                onChange={(e) => setAddType(e.target.value)}
              >
                {AVAILABLE_WIDGETS.map((w) => (
                  <option key={w.type} value={w.type}>
                    {w.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="su-btn su-btn-primary"
                onClick={handleAddWidget}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
