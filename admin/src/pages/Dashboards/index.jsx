import React, { useMemo, useState } from "react";
import { useDashboard } from "../../hooks/useDashboard";

// Small helper for generating local IDs for new links, etc.
function makeId() {
  return Math.random().toString(36).slice(2);
}

const WIDGET_LABELS = {
  quickLinks: "Quick Links",
  htmlBlock: "HTML Block",
  stats: "Stats",
};

export default function DashboardPage() {
  const {
    widgets,
    loading,
    role,
    addWidget,
    updateWidget,
    removeWidget,
  } = useDashboard();

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftConfig, setDraftConfig] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const editingWidget = useMemo(
    () => widgets.find((w) => w.id === editingWidgetId) || null,
    [widgets, editingWidgetId]
  );

  // When you click "Edit" on a widget
  function startEdit(widget) {
    setEditingWidgetId(widget.id);
    setDraftTitle(widget.title || WIDGET_LABELS[widget.type] || "Widget");
    setDraftConfig(widget.config || {});
  }

  function closeEditor() {
    setEditingWidgetId(null);
    setDraftTitle("");
    setDraftConfig({});
    setIsSaving(false);
  }

  // Generic handler for updating draft config
  function updateDraftConfig(path, value) {
    // path can be "html", "links", etc. For now we just shallow-merge.
    setDraftConfig((prev) => ({
      ...prev,
      [path]: value,
    }));
  }

  async function handleSaveWidget() {
    if (!editingWidget) return;
    setIsSaving(true);
    try {
      await updateWidget(editingWidget.id, {
        title: draftTitle,
        config: draftConfig,
      });
      closeEditor();
    } catch (err) {
      console.error("Failed to save widget", err);
      alert("Failed to save widget. Check console for details.");
      setIsSaving(false);
    }
  }

  // Add a new widget with a default config, then open the editor
  async function handleAddWidget(type) {
    try {
      const baseWidget = {
        type,
        title: WIDGET_LABELS[type] || "Widget",
        config: {},
      };

      if (type === "quickLinks") {
        baseWidget.config = {
          links: [
            { id: makeId(), label: "Home", href: "/" },
            { id: makeId(), label: "ServiceUp Docs", href: "#" },
          ],
        };
      } else if (type === "htmlBlock") {
        baseWidget.config = {
          html: "<p>Edit this HTML content in the widget editor.</p>",
        };
      } else if (type === "stats") {
        baseWidget.config = {
          items: [
            { id: makeId(), label: "Total Items", value: "123" },
            { id: makeId(), label: "Active", value: "45" },
          ],
        };
      }

      const newWidget = await addWidget(baseWidget);
      // Immediately open editor for the new widget
      startEdit(newWidget);
      setIsCustomizing(true);
    } catch (err) {
      console.error("Failed to add widget", err);
      alert("Failed to add widget. Check console for details.");
    }
  }

  // Render a preview of each widget in the grid
  function renderWidgetPreview(widget) {
    const typeLabel = WIDGET_LABELS[widget.type] || widget.type;
    const title = widget.title || typeLabel;

    if (widget.type === "quickLinks") {
      const links = (widget.config && widget.config.links) || [];
      return (
        <div className="su-card su-card-widget">
          <div className="su-card-header">
            <div>
              <div className="su-card-kicker">{typeLabel}</div>
              <h3 className="su-card-title">{title}</h3>
            </div>
            {isCustomizing && (
              <button
                className="su-button su-button-xs su-button-ghost"
                onClick={() => startEdit(widget)}
                type="button"
              >
                Edit
              </button>
            )}
          </div>
          <div className="su-card-body">
            {links.length === 0 ? (
              <p className="su-text-muted">
                No links yet. Click Edit to add some.
              </p>
            ) : (
              <ul className="su-quicklinks-list">
                {links.map((link) => (
                  <li key={link.id || link.href}>
                    <span className="su-quicklinks-label">{link.label}</span>
                    <span className="su-quicklinks-url">{link.href}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
    }

    if (widget.type === "htmlBlock") {
      const html = (widget.config && widget.config.html) || "";
      return (
        <div className="su-card su-card-widget">
          <div className="su-card-header">
            <div>
              <div className="su-card-kicker">{typeLabel}</div>
              <h3 className="su-card-title">{title}</h3>
            </div>
            {isCustomizing && (
              <button
                className="su-button su-button-xs su-button-ghost"
                onClick={() => startEdit(widget)}
                type="button"
              >
                Edit
              </button>
            )}
          </div>
          <div className="su-card-body">
            {html ? (
              <div
                className="su-html-preview"
                // Safe because this is admin-authored content
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="su-text-muted">
                Empty HTML block. Click Edit to add content.
              </p>
            )}
          </div>
        </div>
      );
    }

    // Fallback / generic widget
    return (
      <div className="su-card su-card-widget">
        <div className="su-card-header">
          <div>
            <div className="su-card-kicker">{typeLabel}</div>
            <h3 className="su-card-title">{title}</h3>
          </div>
          {isCustomizing && (
            <button
              className="su-button su-button-xs su-button-ghost"
              onClick={() => startEdit(widget)}
              type="button"
            >
              Edit
            </button>
          )}
        </div>
        <div className="su-card-body">
          <pre className="su-code-block">
            {JSON.stringify(widget.config || {}, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // Widget editor forms per type
  function renderWidgetEditorConfig() {
    if (!editingWidget) return null;
    const type = editingWidget.type;

    if (type === "quickLinks") {
      const links = draftConfig.links || [];

      function updateLink(idx, key, value) {
        const next = links.map((link, i) =>
          i === idx ? { ...link, [key]: value } : link
        );
        updateDraftConfig("links", next);
      }

      function addLink() {
        updateDraftConfig("links", [
          ...links,
          { id: makeId(), label: "New Link", href: "#" },
        ]);
      }

      function removeLink(idx) {
        const next = links.filter((_, i) => i !== idx);
        updateDraftConfig("links", next);
      }

      return (
        <div className="su-widget-editor-section">
          <h3 className="su-widget-editor-heading">Quick Links</h3>
          <p className="su-widget-editor-help">
            Add or edit links that appear in this widget on your dashboard.
          </p>
          <div className="su-widget-editor-list">
            {links.map((link, idx) => (
              <div key={link.id || idx} className="su-widget-editor-row">
                <div className="su-field-group">
                  <label className="su-label">Label</label>
                  <input
                    className="su-input"
                    value={link.label || ""}
                    onChange={(e) =>
                      updateLink(idx, "label", e.target.value)
                    }
                    placeholder="e.g. Home"
                  />
                </div>
                <div className="su-field-group">
                  <label className="su-label">URL</label>
                  <input
                    className="su-input"
                    value={link.href || ""}
                    onChange={(e) => updateLink(idx, "href", e.target.value)}
                    placeholder="https://… or /relative-url"
                  />
                </div>
                <button
                  type="button"
                  className="su-button su-button-xs su-button-ghost su-widget-editor-remove"
                  onClick={() => removeLink(idx)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="su-button su-button-sm su-button-outline"
            onClick={addLink}
          >
            + Add Link
          </button>
        </div>
      );
    }

    if (type === "htmlBlock") {
      return (
        <div className="su-widget-editor-section">
          <h3 className="su-widget-editor-heading">HTML Content</h3>
          <p className="su-widget-editor-help">
            Paste or write HTML. This is rendered as-is on your dashboard.
          </p>
          <textarea
            className="su-textarea su-textarea-code"
            rows={10}
            value={draftConfig.html || ""}
            onChange={(e) => updateDraftConfig("html", e.target.value)}
            placeholder="<p>Welcome to your dashboard…</p>"
          />
        </div>
      );
    }

    // Generic fallback
    return (
      <div className="su-widget-editor-section">
        <h3 className="su-widget-editor-heading">Raw Config</h3>
        <p className="su-widget-editor-help">
          This widget type doesn&apos;t have a custom form yet. You can edit
          its JSON configuration directly.
        </p>
        <textarea
          className="su-textarea su-textarea-code"
          rows={10}
          value={JSON.stringify(draftConfig, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setDraftConfig(parsed);
            } catch {
              // allow temporary invalid JSON in the UI
              setDraftConfig(e.target.value);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="su-page">
      <div className="su-page-header">
        <div>
          <p className="su-page-kicker">
            {role ? `Dashboard for ${role}` : "Dashboard"}
          </p>
          <h1 className="su-page-title">Dashboard</h1>
        </div>
        <div className="su-page-actions">
          <button
            type="button"
            className="su-button su-button-ghost"
            onClick={() => setIsCustomizing((v) => !v)}
          >
            {isCustomizing ? "Done Customizing" : "Customize"}
          </button>
        </div>
      </div>

      <div className="su-page-body">
        {/* Widget Library (only when customizing) */}
        {isCustomizing && (
          <div className="su-dashboard-library">
            <h2 className="su-section-title">Add Widget</h2>
            <div className="su-dashboard-library-grid">
              <button
                type="button"
                className="su-card su-card-clickable"
                onClick={() => handleAddWidget("quickLinks")}
              >
                <div className="su-card-header">
                  <h3 className="su-card-title">Quick Links</h3>
                </div>
                <div className="su-card-body">
                  <p className="su-text-muted">
                    A list of links for fast navigation (e.g. client tools,
                    reports, or favorite pages).
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="su-card su-card-clickable"
                onClick={() => handleAddWidget("htmlBlock")}
              >
                <div className="su-card-header">
                  <h3 className="su-card-title">HTML Block</h3>
                </div>
                <div className="su-card-body">
                  <p className="su-text-muted">
                    Free-form HTML content: announcements, instructions,
                    embedded iframes, etc.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="su-card su-card-clickable"
                onClick={() => handleAddWidget("stats")}
              >
                <div className="su-card-header">
                  <h3 className="su-card-title">Stats</h3>
                </div>
                <div className="su-card-body">
                  <p className="su-text-muted">
                    Simple metrics (totals, counts) you can wire up later.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Main widget grid */}
        {loading ? (
          <p className="su-text-muted">Loading dashboard…</p>
        ) : widgets.length === 0 ? (
          <p className="su-text-muted">
            No widgets yet. Click <strong>Customize</strong> and add your first
            widget.
          </p>
        ) : (
          <div className="su-dashboard-grid">
            {widgets.map((widget) => (
              <div key={widget.id} className="su-dashboard-grid-item">
                {renderWidgetPreview(widget)}

                {isCustomizing && (
                  <div className="su-widget-controls">
                    <button
                      type="button"
                      className="su-button su-button-xs"
                      onClick={() => startEdit(widget)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="su-button su-button-xs su-button-danger-ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Remove this widget from your dashboard?"
                          )
                        ) {
                          removeWidget(widget.id);
                          if (editingWidgetId === widget.id) {
                            closeEditor();
                          }
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slide-over Widget Editor */}
      {editingWidget && (
        <div className="su-drawer-backdrop">
          <div className="su-drawer">
            <div className="su-drawer-header">
              <div>
                <p className="su-drawer-kicker">
                  {WIDGET_LABELS[editingWidget.type] || editingWidget.type}
                </p>
                <h2 className="su-drawer-title">Edit Widget</h2>
              </div>
              <button
                type="button"
                className="su-button su-button-ghost"
                onClick={closeEditor}
              >
                Close
              </button>
            </div>

            <div className="su-drawer-body">
              <div className="su-field-group">
                <label className="su-label">Title</label>
                <input
                  className="su-input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Widget title"
                />
              </div>

              {renderWidgetEditorConfig()}
            </div>

            <div className="su-drawer-footer">
              <button
                type="button"
                className="su-button su-button-ghost"
                onClick={closeEditor}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="su-button su-button-primary"
                onClick={handleSaveWidget}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save Widget"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
