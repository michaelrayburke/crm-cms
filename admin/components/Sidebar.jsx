import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const NavItem = ({ to, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => 'su-btn' + (isActive ? ' primary' : '')}
    style={{ display: 'block', marginBottom: 8 }}
  >
    {label}
  </NavLink>
);

export default function Sidebar() {
  const { settings } = useSettings();
  const items =
    settings?.nav || [
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

  return (
    <aside className="su-sidebar">
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Menu</div>
      {items.map((it, i) => (
        <NavItem key={i} to={it.to} label={it.label} />
      ))}
    </aside>
  );
}
