import React, { useEffect, useState } from 'react';
import WidgetRenderer from './widgets/WidgetRenderer';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../lib/api';

const DEFAULT_WIDGETS = [
  {
    id: 'w1',
    type: 'quickLinks',
    title: 'Quick Widgets',
    config: {
      links: [
        { label: 'Content', to: '/admin/content' },
        { label: 'Settings', to: '/admin/settings' },
      ],
    },
  },
  {
    id: 'w2',
    type: 'html',
    title: 'Welcome Widget',
    config: {
      html: '<p>This area is made of Widgets (named in honor of Widget 🐾).</p>',
    },
  },
];

export default function Dashboard() {
  const { settings, setSettings, loading } = useSettings();
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load from settings when available
  useEffect(() => {
    if (!settings) return;
    if (Array.isArray(settings.dashboardWidgets)) {
      setWidgets(settings.dashboardWidgets);
    } else {
      setWidgets(DEFAULT_WIDGETS);
    }
  }, [settings]);

  function addWidget(type) {
    const id = String(Math.random()).slice(2);
    const base = {
      id,
      type,
      title: type === 'quickLinks' ? 'Quick Links Widget' : 'Custom HTML Widget',
      config: {},
    };
    if (type === 'quickLinks') {
      base.config.links = [{ label: 'Dashboard', to: '/admin' }];
    } else if (type === 'html') {
      base.config.html = '<p>New Widget</p>';
    }
    setWidgets((w) => [...w, base]);
  }

  function removeWidget(id) {
    setWidgets((ws) => ws.filter((w) => w.id !== id));
  }

  function updateWidget(id, patch) {
    setWidgets((ws) =>
      ws.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );
  }

  function updateWidgetConfig(id, patch) {
    setWidgets((ws) =>
      ws.map((w) =>
        w.id === id ? { ...w, config: { ...(w.config || {}), ...patch } } : w
      )
    );
  }

  async function persistWidgets() {
    if (!settings) return;
    setSaving(true);
    try {
      const payload = { ...settings, dashboardWidgets: widgets };
      const updated =
        typeof api.put === 'function'
          ? await api.put('/settings', payload)
          : await api.post('/settings', payload);
      setSettings(updated);
    } catch (e) {
      console.error('Error saving widgets to settings', e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEditing() {
    if (editing) {
      await persistWidgets();
    }
    setEditing((v) => !v);
  }

  if (loading && !settings) {
    return (
      <div className="su-card">
        <p>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p style={{ marginTop: 4, marginBottom: 16, opacity: 0.8 }}>
        Arrange and configure your admin Widgets (named in honor of Widget 🐾).
      </p>

      <div className="su-grid cols-2">
        {widgets.map((w) => (
          <div key={w.id} className="su-card">
            {editing ? (
              <div>
                <input
                  className="su-input"
                  value={w.title || ''}
                  onChange={(e) =>
                    updateWidget(w.id, { title: e.target.value })
                  }
                  placeholder="Widget title"
                  style={{ marginBottom: 8 }}
                />

                {w.type === 'html' && (
                  <div>
                    <label style={{ fontSize: 12, opacity: 0.75 }}>
                      HTML content
                    </label>
                    <textarea
                      className="su-input"
                      style={{ minHeight: 120, marginTop: 4 }}
                      value={w.config?.html || ''}
                      onChange={(e) =>
                        updateWidgetConfig(w.id, { html: e.target.value })
                      }
                    />
                  </div>
                )}

                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <button
                    className="su-btn"
                    type="button"
                    onClick={() => removeWidget(w.id)}
                  >
                    Remove Widget
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {w.title && <h2 style={{ marginTop: 0 }}>{w.title}</h2>}
                <WidgetRenderer widget={w} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', right: 16, bottom: 16 }}>
        {editing && (
          <div style={{ marginBottom: 8, textAlign: 'right' }}>
            <button
              className="su-btn"
              onClick={() => addWidget('quickLinks')}
              style={{ marginRight: 4 }}
              type="button"
            >
              + Quick Links Widget
            </button>
            <button
              className="su-btn"
              onClick={() => addWidget('html')}
              type="button"
            >
              + HTML Widget
            </button>
          </div>
        )}
        <button
          className="su-btn primary"
          onClick={toggleEditing}
          aria-label="Edit Widgets"
          type="button"
        >
          {editing
            ? saving
              ? 'Saving Widgets…'
              : 'Done Editing Widgets'
            : 'Edit Widgets'}
        </button>
      </div>
    </div>
  );
}
