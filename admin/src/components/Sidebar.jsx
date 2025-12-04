import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

// Utility to check if the current role can see an item.  If the item has
// no roles specified (or roles is an empty array), it's visible to all.
const canSee = (itemRoles, role) => {
  if (!Array.isArray(itemRoles) || itemRoles.length === 0) return true;
  if (!role) return false;
  return itemRoles.includes(role);
};

// Stateless link component for sidebar links.  Applies a primary class when
// the NavLink matches the current location.
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

/**
 * Sidebar renders a navigation sidebar.  It accepts an `onClose` callback
 * which will be called when the user clicks the mobile close button and a
 * `role` prop used to filter items by role.
 */
export default function Sidebar({ onClose, role = 'ADMIN' }) {
  const { settings } = useSettings();
  const location = useLocation();

  // Define a sensible default nav when settings.navSidebar isn't provided.
  // Pages that are not under the `/admin/settings` path live at the root of
  // the sidebar. All settings sub-routes are grouped beneath the Settings
  // parent by default. Quick Builder is included as a root-level item.
  // If you add new settings sub-pages in App.jsx, consider adding them
  // under the Settings parent below so they appear automatically.
  const defaultNav = [
    { label: 'Dashboard', to: '/admin' },
    { label: 'Menus', to: '/admin/menus' },
    { label: 'Headers', to: '/admin/headers' },
    { label: 'Footers', to: '/admin/footers' },
    { label: 'Users', to: '/admin/users' },
    { label: 'Taxonomies', to: '/admin/taxonomies' },
    { label: 'Content', to: '/admin/content' },
    { label: 'Quick Builder', to: '/admin/quick-builder' },
    {
      label: 'Settings',
      children: [
        { label: 'Settings', to: '/admin/settings' },
        { label: 'Roles', to: '/admin/settings/roles' },
        { label: 'Dashboards', to: '/admin/settings/dashboards' },
        { label: 'Permissions', to: '/admin/settings/permissions' },
        { label: 'Entry Views', to: '/admin/settings/entry-views' },
        { label: 'List Views', to: '/admin/settings/list-views' },
      ],
    },
  ];

  // Determine which nav items to render: prefer settings.navSidebar, then
  // settings.nav, otherwise fall back to defaultNav.
  const items =
    (Array.isArray(settings?.navSidebar) && settings.navSidebar.length > 0
      ? settings.navSidebar
      : settings?.nav) || defaultNav;

  // Keep track of which parent menus are expanded.
  const [openParents, setOpenParents] = useState({});

  // Automatically open any parent whose children contain the current route.
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
        // Skip the item if the current role isn't allowed to see it.
        if (!canSee(item.roles, role)) return null;
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
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
        const isOpen = !!openParents[i];
        const visibleChildren = item.children.filter((child) =>
          canSee(child.roles, role)
        );
        if (visibleChildren.length === 0) {
          // If no children are visible, show parent as direct link if it has a `to`.
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
            className={
              'su-nav-parent' + (isOpen ? ' open' : '')
            }
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