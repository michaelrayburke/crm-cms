import React from 'react';
import { NavLink } from 'react-router-dom';

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

export default function Sidebar() {
  return (
    <aside className="su-sidebar-inner">
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Navigation</div>
      <NavItem to="/admin">Dashboard</NavItem>
      <NavItem to="/admin/content">Content</NavItem>
      <NavItem to="/admin/taxonomies">Taxonomies</NavItem>
      <NavItem to="/admin/users">Users</NavItem>
      <div style={{ margin: '16px 0', borderTop: '1px solid var(--su-border)' }} />
      <NavItem to="/admin/menus">Menus</NavItem>
      <NavItem to="/admin/headers">Headers</NavItem>
      <NavItem to="/admin/footers">Footers</NavItem>
      <NavItem to="/admin/settings">Settings</NavItem>
      <div style={{ marginTop: 16, opacity: 0.7 }}>
        <NavItem to="/quick-builder">Quick Builder</NavItem>
      </div>
    </aside>
  );
}
