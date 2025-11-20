import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

function isButtonVisibleForRole(item, role) {
  const raw = item.allowedRoles;
  if (!raw) return true;
  const roles = String(raw)
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  if (!roles.length) return true;
  if (!role) return false;
  return roles.includes(String(role).toUpperCase());
}

export default function Topbar() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const appName = settings?.appName || 'ServiceUp';

  const defaultButtons = [{ label: 'Quick Builder', to: '/quick-builder' }];

  const buttons =
    settings && Array.isArray(settings.navTopbarButtons)
      ? settings.navTopbarButtons
      : defaultButtons;

  const role = user?.role || null;
  const visibleButtons = buttons.filter((btn) =>
    isButtonVisibleForRole(btn, role)
  );

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('su-sidebar-open', next);
      }
      return next;
    });
  };

  return (
    <header className="su-topbar">
      <div className="su-topbar-inner">
        <div className="su-topbar-left">
          {/* Hamburger for mobile / small screens */}
          <button
            type="button"
            className="su-btn su-topbar-hamburger"
            aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            aria-controls="su-sidebar"
            aria-expanded={sidebarOpen ? 'true' : 'false'}
            onClick={toggleSidebar}
          >
            ☰
          </button>

          <span className="su-logo">{appName}</span>
        </div>

        <nav className="su-topbar-right">
          {visibleButtons.map((btn) =>
            btn.to ? (
              <Link
                key={btn.label + btn.to}
                to={btn.to}
                className="su-btn ghost"
              >
                {btn.label}
              </Link>
            ) : null
          )}
        </nav>
      </div>
    </header>
  );
}
