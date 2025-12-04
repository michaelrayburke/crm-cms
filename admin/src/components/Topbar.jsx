import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

// Utility to determine if a navigation item should be shown for the current role.
const canSee = (itemRoles, role) => {
  if (!Array.isArray(itemRoles) || itemRoles.length === 0) return true;
  if (!role) return false;
  return itemRoles.includes(role);
};

/**
 * Topbar renders the top navigation bar.  It accepts callbacks to toggle
 * the sidebar on mobile (`onToggleSidebar`) and a boolean `isSidebarOpen`
 * to set the appropriate aria-label.  It also accepts a `role` prop to
 * filter items based on allowed roles.
 */
export default function Topbar({ onToggleSidebar, isSidebarOpen, role = 'ADMIN' }) {
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
      <div className="su-topbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            className="su-btn su-topbar-hamburger"
            onClick={onToggleSidebar}
            aria-label={
              isSidebarOpen
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
          >
            ☰
          </button>
        )}
        <div className="su-topbar-title">
          {settings?.appName || 'ServiceUp Admin'}
        </div>
      </div>
      <nav className="su-topbar-nav" aria-label="Top navigation">
        {items
          .filter((item) => canSee(item.roles, role))
          .map((item, i) => {
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            if (!hasChildren) {
              if (!item.to) return null;
              return (
                <NavLink
                  key={i}
                  to={item.to}
                  target={item.target || '_self'}
                  className={({ isActive }) =>
                    'su-btn su-topbar-link' + (isActive ? ' primary' : '')
                  }
                >
                  {item.label || 'Link'}
                </NavLink>
              );
            }
            const isOpen = openIndex === i;
            const visibleChildren = item.children.filter((child) =>
              canSee(child.roles, role)
            );
            if (visibleChildren.length === 0) {
              if (!item.to) return null;
              return (
                <NavLink
                  key={i}
                  to={item.to}
                  target={item.target || '_self'}
                  className={({ isActive }) =>
                    'su-btn su-topbar-link' + (isActive ? ' primary' : '')
                  }
                >
                  {item.label || 'Link'}
                </NavLink>
              );
            }
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
                    {visibleChildren.map((child, ci) =>
                      child.to ? (
                        <NavLink
                          key={ci}
                          to={child.to}
                          target={child.target || item.target || '_self'}
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
      </nav>
    </header>
  );
}