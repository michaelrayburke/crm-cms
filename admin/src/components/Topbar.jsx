import React from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

export default function Topbar() {
  const { settings } = useSettings();
  const appName = settings?.appName || 'ServiceUp';

  const defaultButtons = [
    { label: 'Quick Builder', to: '/quick-builder' },
  ];

  const buttons =
    settings && Array.isArray(settings.navTopbarButtons)
      ? settings.navTopbarButtons
      : defaultButtons;

  return (
    <header className="su-topbar">
      <div className="su-topbar-inner">
        <div className="su-topbar-left">
          <span className="su-logo">{appName}</span>
        </div>
        <nav className="su-topbar-right">
          {buttons.map((btn) =>
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
