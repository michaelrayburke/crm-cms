import React, { useState } from 'react';
import WidgetRenderer from './widgets/WidgetRenderer';

export default function Dashboard() {
  const [widgets, setWidgets] = useState([
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
  ]);
  const [editing, setEditing] = useState(false);

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

  return (
    <div>
      <div className="su-card">
        <h1>Dashboard Widgets</h1>
        <p style={{ opacity: 0.8 }}>
          These blocks are your <strong>Widgets</strong>. You can add or remove
          them here. (Hi Widget 🐶💙)
        </p>
      </div>

      <div className="su-grid">
        {widgets.map((w) => (
          <div key={w.id} className="su-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <strong>{w.title || w.type}</strong>
              {editing && (
                <button
                  className="su-btn"
                  onClick={() => removeWidget(w.id)}
                >
                  Remove Widget
                </button>
              )}
            </div>
            <WidgetRenderer widget={w} />
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
            >
              + Quick Links Widget
            </button>
            <button
              className="su-btn"
              onClick={() => addWidget('html')}
            >
              + HTML Widget
            </button>
          </div>
        )}
        <button
          className="su-btn primary"
          onClick={() => setEditing((v) => !v)}
          aria-label="Edit Widgets"
        >
          {editing ? 'Done Editing Widgets' : 'Edit Widgets'}
        </button>
      </div>
    </div>
  );
}
