// admin/src/pages/Dashboards/index.jsx
import React, { useMemo, useState } from "react";
import { useDashboard } from "../../hooks/useDashboard";

// Basic library of widget "types" the builder can create
const WIDGET_LIBRARY = [
  {
    type: "quick-links",
    title: "Quick Links",
    description:
      "A list of links for fast navigation (client tools, reports, favorite pages).",
    defaultConfig: {
      links: [
        { id: "content", label: "Content", href: "/admin/content" },
        { id: "users", label: "Users", href: "/admin/users" },
      ],
    },
    roles: ["ADMIN", "EDITOR"],
  },
  {
    type: "html-block",
    title: "HTML Block",
    description:
      "Free-form HTML content: announcements, instructions, embedded iframes, etc.",
    defaultConfig: {
      html: "<p>Edit this HTML block to add announcements or instructions.</p>",
    },
    roles: ["ADMIN", "EDITOR"],
  },
  {
    type: "stats",
    title: "Stats",
    description: "Simple metrics (totals, counts) you can wire up later.",
    defaultConfig: {
      items: [
        { id: "entries", label: "Entries", value: 0 },
        { id: "users", label: "Users", value: 0 },
      ],
    },
    roles: ["ADMIN"],
  },
];

function getCurrentRole() {
  try {
    const raw = localStorage.getItem("serviceup.user");
    if (!raw) return "ADMIN";
    const parsed = JSON.parse(raw);
    return (parsed.role || "ADMIN").toUpperCase();
  } catch {
    return "ADMIN";
  }
}

export default function DashboardPage() {
  const {
    widgets,
    loading,
    saving,
    error,
    addWidget,
    updateWidget,
    removeWidget,
  } = useDashboard();

  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState("");

  const currentRole = getCurrentRole();

  // Only show widgets allowed for the current role
  const visibleWidgets = useMemo(
    () =>
      (widgets || []).filter(
        (w) =>
          !w.roles ||
          !w.roles.length ||
          w.roles.map((r) => r.toUpperCase()).includes(currentRole)
      ),
    [widgets, currentRole]
  );

  const availableWidgetTypes = useMemo(
    () =>
      WIDGET_LIBRARY.filter((w) =>
        !w.roles || w.roles.includes(currentRole)
      ),
    [currentRole]
  );

  function handleAddWidgetClick(type) {
    const def = WIDGET_LIBRARY.find((w) => w.type === type);
    if (!def) {
      alert("Unknown widget type.");
      return;
    }
    addWidget({
      id: `${type}-${Date.now()}`,
      type: def.type,
      title: def.title,
      config: def.defaultConfig,
      roles: def.roles || [],
    });
    setIsAdding(false);
    setSelectedType("");
  }

  function renderWidget(widget) {
    const { id, type, title, config = {} } = widget;
    const key = id || `${type}-${Math.random()}`;

    // Safety guard: if type is unknown, show a placeholder instead of crashing
    const libraryDef = WIDGET_LIBRARY.find((w) => w.type === type);

    return (
      <div key={key} className="su-card su-dashboard-widget">
        <div className="su-dashboard-widget__header">
          <h3>{title || libraryDef?.title || "Widget"}</h3>
          <div className="su-dashboard-widget__actions">
            <button
              type="button"
              className="su-btn"
              onClick={() =>
                updateWidget(id, {
                  // Very minimal editor for now; you’ll expand this later
                  title:
                    window.prompt("Widget title:", title || "") || title || "",
                })
              }
            >
              Edit
            </button>
            <button
              type="button"
              className="su-btn danger"
              onClick={() => removeWidget(id)}
            >
              Remove
            </button>
          </div>
        </div>

        <div className="su-dashboard-widget__body">
          {type === "quick-links" && (
            <ul className="su-dashboard-quicklinks">
              {(config.links || []).map((link) => (
                <li key={link.id || link.href}>
                  <a href={link.href} className="su-link">
                    {link.label || link.href}
                  </a>
                </li>
              ))}
              {(!config.links || config.links.length === 0) && (
                <p className="su-text-muted">
                  No links yet. A future editor will let you customize these.
                </p>
              )}
            </ul>
          )}

          {type === "html-block" && (
            <div
              className="su-dashboard-html"
              // This is specifically for trusted admin-created content
              dangerouslySetInnerHTML={{ __html: config.html || "" }}
            />
          )}

          {type === "stats" && (
            <div className="su-dashboard-stats">
              {(config.items || []).map((item) => (
                <div
                  key={item.id}
                  className="su-dashboard-stat su-card--soft"
                >
                  <div className="su-dashboard-stat__label">
                    {item.label}
                  </div>
                  <div className="su-dashboard-stat__value">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!["quick-links", "html-block", "stats"].includes(type) && (
            <p className="su-text-muted">
              Unknown widget type: <code>{type}</code>. Update the dashboard
              code to support this widget.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="su-page su-page--dashboard">
      <div className="su-page-header">
        <div>
          <h1 className="su-page-title">Dashboard</h1>
          <p className="su-page-subtitle">
            Role: <strong>{currentRole}</strong>. Customize widgets for each
            role using the builder below.
          </p>
        </div>
        <div className="su-page-header__actions">
          {saving && (
            <span className="su-text-muted" style={{ fontSize: 12 }}>
              Saving…
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="su-alert su-alert--error">
          <div className="su-alert__title">Dashboard error</div>
          <div className="su-alert__body">{error}</div>
        </div>
      )}

      <section className="su-dashboard-add">
        <div className="su-card su-dashboard-add__card">
          <div className="su-dashboard-add__header">
            <h2>Add Widget</h2>
            <p>
              Choose a widget type to add to the {currentRole.toLowerCase()}{" "}
              dashboard.
            </p>
          </div>
          <div className="su-dashboard-add__types">
            {availableWidgetTypes.map((wt) => (
              <button
                key={wt.type}
                type="button"
                className="su-dashboard-add__type su-btn ghost"
                onClick={() => handleAddWidgetClick(wt.type)}
              >
                <div className="su-dashboard-add__type-title">{wt.title}</div>
                <div className="su-dashboard-add__type-description">
                  {wt.description}
                </div>
              </button>
            ))}
            {availableWidgetTypes.length === 0 && (
              <p className="su-text-muted">
                No widget types are available for this role yet.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="su-dashboard-widgets">
        {loading ? (
          <p className="su-text-muted">Loading dashboard…</p>
        ) : visibleWidgets.length === 0 ? (
          <p className="su-text-muted">
            No widgets yet. Use “Add Widget” above to create one.
          </p>
        ) : (
          <div className="su-grid cols-2 gap-lg">
            {visibleWidgets.map((w) => renderWidget(w))}
          </div>
        )}
      </section>
    </div>
  );
}
