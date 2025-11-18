// admin/src/components/Sidebar.jsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

const navItemBaseClass = 'su-btn su-nav-link';

const NavItem = ({ to, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `${navItemBaseClass}${isActive ? ' primary' : ''}`
    }
    style={{ display: 'block', marginBottom: 8 }}
  >
    {children}
  </NavLink>
);

const DEFAULT_NAV = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Content', to: '/admin/content' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Taxonomies', to: '/admin/taxonomies' },
  { label: 'Headers', to: '/admin/headers' },
  { label: 'Footers', to: '/admin/footers' },
  { label: 'Menus', to: '/admin/menus' },
  { label: 'Settings', to: '/admin/settings' },
];

function isNavItemVisibleForRole(item, role) {
  const raw = item.allowedRoles;
  if (!raw) return true; // no restriction

  const roles = String(raw)
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);

  if (!roles.length) return true;
  if (!role) return false;

  return roles.includes(String(role).toUpperCase());
}

export default function Sidebar() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || null;

  const navItems =
    settings &&
    Array.isArray(settings.navSidebar) &&
    settings.navSidebar.length
      ? settings.navSidebar
      : DEFAULT_NAV;

  const visibleNavItems = navItems.filter((item) =>
    isNavItemVisibleForRole(item, role)
  );

  return (
    <aside className="su-sidebar">
      <div style={{ padding: 16 }}>
        {visibleNavItems.map((item) => (
          <NavItem key={item.to} to={item.to}>
            {item.label}
          </NavItem>
        ))}

        <div
          style={{
            marginTop: 24,
            borderTop: '1px solid var(--su-border)',
            paddingTop: 12,
          }}
        >
          <button
            type="button"
            className="su-btn"
            style={{ width: '100%' }}
            onClick={() => navigate('/admin/settings#navigation')}
          >
            ✏️ Edit navigation
          </button>
        </div>
      </div>
    </aside>
  );
}
