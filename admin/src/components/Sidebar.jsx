import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const canSee = (itemRoles, role) => {
  if (!Array.isArray(itemRoles) || itemRoles.length === 0) return true;
  if (!role) return false;
  return itemRoles.includes(role);
};

const SidebarLink = ({ to, label, target }) => (
  <NavLink
    to={to}
    target={target || '_self'}
    className={({ isActive }) =>
      'su-btn su-nav-link' + (isActive ? ' primary' : '')
    }
    style={{ display: 'block', marginBottom: 8 }}
  >
    {label}
  </NavLink>
);

export default function Sidebar({ onClose, role = 'ADMIN' }) {
  const { settings } = useSettings();
  const location = useLocation();

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
      { label: 'Quick Builder', to: '/admin/quick-builder' },
    ];

  // Track which parents are expanded
  const [openParents, setOpenParents] = useState({});

  // Open any parent whose child matches current route
  useEffect(() => {
    const path = location.pathname;
    const next = {};
    items.forEach((item, index) => {
      if (
        Array.isArray(item.children) &&
        item.children.some(
          (child) => child.to && path.startsWith(child.to),
        )
      ) {
        next[index] = true;
      }
    });
    setOpenParents((prev) => ({ ...prev, ...next }));
  }, [location.pathname, items]);

  const toggleParent = (index) => {
    setOpenParents((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <aside className="su-sidebar" aria-label="Main navigation">
      {/* Mobile close button */}
      {onClose && (
        <button
          type="button"
          className="su-btn su-sidebar-close"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          ✕ Close
        </button>
      )}

      <div className="su-nav-header">Menu</div>

      {items.map((item, i) => {
        if (!canSee(item.roles, role)) return null;

        const hasChildren =
          Array.isArray(item.children) && item.children.length > 0;

        // Simple link
        if (!hasChildren) {
          if (!item.to) return null;
          return (
            <SidebarLink
              key={i}
              to={item.to}
              label={item.label || 'Untitled'}
              target={item.target}
            />
          );
        }

        // Parent with children
        const isOpen = !!openParents[i];

        const visibleChildren = item.children.filter((child) =>
          canSee(child.roles, role),
        );

        // If no visible children, we can still show the parent as a direct link
        if (visibleChildren.length === 0) {
          if (!item.to) return null;
          return (
            <SidebarLink
              key={i}
              to={item.to}
              label={item.label || 'Untitled'}
              target={item.target}
            />
          );
        }

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
                {visibleChildren.map((child, ci) =>
                  child.to ? (
                    <SidebarLink
                      key={ci}
                      to={child.to}
                      label={child.label || 'Link'}
                      target={child.target || item.target}
                    />
                  ) : null,
                )}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
