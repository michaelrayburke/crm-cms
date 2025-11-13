import React from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

export default function Topbar({ onToggleSidebar, onToggleCollapse }) {
  const { settings } = useSettings();
  const appName = settings?.appName || 'ServiceUp Admin';

  return (
    <header className="su-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="su-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          aria-controls="admin-sidebar"
        >
          ☰
        </button>
        <button
          className="su-btn"
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
        >
          ⇔
        </button>
        <img
          src={settings?.logoUrl || '/assets/logo.svg'}
          alt=""
          style={{ height: 28 }}
        />
        <strong>{appName}</strong>
      </div>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link className="su-btn" to="/site">
          View site/app
        </Link>
        <Link className="su-btn" to="/admin/content">
          Content
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>hello, user!</span>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#4f8bff',
            }}
          />
        </div>
      </nav>
    </header>
  );
}
