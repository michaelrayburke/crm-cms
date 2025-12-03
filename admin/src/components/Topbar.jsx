import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

export default function Topbar({
  onToggleSidebar,
  onToggleCollapse,
  isSidebarOpen,
  isCollapsed,
}) {
  const { settings } = useSettings();
  const [openIndex, setOpenIndex] = useState(null);

  const items = Array.isArray(settings?.navTopbarButtons)
    ? settings.navTopbarButtons
    : [];

  const handleToggle = (index) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <header className="su-topbar">
      {/* Left side: hamburger + app name */}
      <div className="su-topbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            className="su-btn su-topbar-hamburger"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            ☰
          </button>
        )}

        <div className="su-topbar-title">
          {settings?.appName || 'ServiceUp Admin'}
        </div>
      </div>

      {/* Right side: topbar nav + collapse button */}
      <nav className="su-topbar-nav" aria-label="Top navigation">
        {items.map((item, i) => {
          const hasChildren =
            Array.isArray(item.children) && item.children.length > 0;

          // Simple link
          if (!hasChildren) {
            if (!item.to) return null;
            return (
              <NavLink
                key={i}
                to={item.to}
                className={({ isActive }) =>
                  'su-btn su-topbar-link' + (isActive ? ' primary' : '')
                }
              >
                {item.label || 'Link'}
              </NavLink>
            );
          }

          // Parent with dropdown
          const isOpen = openIndex === i;

          return (
            <div
              key={i}
              className={
                'su-topbar-dropdown-wrapper' + (isOpen ? ' open' : '')
              }
            >
              <button
                type="button"
                className="su-btn su-topbar-link su-topbar-parent"
                onClick={() => handleToggle(i)}
              >
                <span>{item.label || 'Menu'}</span>
                <span className="su-nav-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
              {isOpen && (
                <div className="su-topbar-dropdown" role="menu">
                  {item.children.map((child, ci) =>
                    child.to ? (
                      <NavLink
                        key={ci}
                        to={child.to}
                        className="su-topbar-dropdown-link"
                        role="menuitem"
                      >
                        {child.label || 'Link'}
                      </NavLink>
                    ) : null
                  )}
                </div>
              )}
            </div>
          );
        })}

        {onToggleCollapse && (
          <button
            type="button"
            className="su-btn su-topbar-link"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? '⤢' : '⤡'}
          </button>
        )}
      </nav>
    </header>
  );
}
