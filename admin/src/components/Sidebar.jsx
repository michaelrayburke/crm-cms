import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

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

export default function Sidebar() {
  const { settings } = useSettings();
  const navigate = useNavigate();

  const navItems =
    settings && Array.isArray(settings.navSidebar) && settings.navSidebar.length
      ? settings.navSidebar
      : DEFAULT_NAV;

  return (
    <aside className="su-sidebar">
      <div style={{ padding: 16 }}>
        {navItems.map((item) => (
          <NavItem key={item.to} to={item.to}>
            {item.label}
          </NavItem>
        ))}

        <div style={{ marginTop: 24, borderTop: '1px solid var(--su-border)', paddingTop: 12 }}>
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
