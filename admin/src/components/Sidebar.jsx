import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const SidebarLink = ({ to, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      'su-btn su-nav-link' + (isActive ? ' primary' : '')
    }
    style={{ display: 'block', marginBottom: 8 }}
  >
    {label}
  </NavLink>
);

export default function Sidebar() {
  const { settings } = useSettings();
  const location = useLocation();

  // Prefer DB-driven sidebar nav, but fall back to old static list
  const items =
    (Array.isArray(settings?.navSidebar) && settings.navSidebar.length > 0
      ? settings.navSidebar
      : settings?.nav) || [
      { label: 'Dashboard', to: '/admin' },
      { label: 'Settings', to: '/admin/settings' },
      { label: 'Menus', to: '/admin/menus' },
      { label: 'Headers', to: '/admin/headers' },
      { label: 'Footers', to: '/admin/footers' },
      { label: 'Users', to: '/admin/users' },
      { label: 'Taxonomies', to: '/admin/taxonomies' },
      { label: 'Content', to: '/admin/content' },
      { label: 'Quick Builder', to: '/quick-builder' },
    ];

  // Track which parent items are expanded
  const [openParents, setOpenParents] = useState({});

  // Auto-open parents if one of their children matches the current route
  useEffect(() => {
    const path = location.pathname;
    const nextOpen = {};
    items.forEach((item, index) => {
      if (
        Array.isArray(item.children) &&
        item.children.some(
          (child) => child.to && path.startsWith(child.to)
        )
      ) {
        nextOpen[index] = true;
      }
    });
    setOpenParents((prev) => ({ ...prev, ...nextOpen }));
  }, [location.pathname, items]);

  const toggleParent = (index) => {
    setOpenParents((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <aside className="su-sidebar" aria-label="Main navigation">
      <div className="su-nav-header">Menu</div>

      {items.map((item, i) => {
        const hasChildren =
          Array.isArray(item.children) && item.children.length > 0;

        // Simple link (no children)
        if (!hasChildren) {
          if (!item.to) return null;
          return (
            <SidebarLink
              key={i}
              to={item.to}
              label={item.label || 'Untitled'}
            />
          );
        }

        // Parent with children
        const isOpen = !!openParents[i];

        return (
          <div
            key={i}
            className={'su-nav-parent' + (isOpen ? ' open' : '')}
          >
            <button
              type="button"
              className="su-btn su-nav-parent-toggle"
              onClick={() => toggleParent(i)}
            >
              <span className="su-nav-parent-label">
                {item.label || 'Section'}
              </span>
              <span className="su-nav-caret" aria-hidden="true">
                ▸
              </span>
            </button>

            {isOpen && (
              <div className="su-nav-children">
                {item.children.map((child, ci) =>
                  child.to ? (
                    <SidebarLink
                      key={ci}
                      to={child.to}
                      label={child.label || 'Link'}
                    />
                  ) : null
                )}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
