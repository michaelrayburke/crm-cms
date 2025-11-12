import React from 'react';
import { NavLink } from 'react-router-dom';

const NavItem = ({ to, children }) => (
  <NavLink to={to} className={({isActive}) => 'su-btn' + (isActive ? ' primary' : '')} style={{ display:'block', marginBottom:8 }}>
    {children}
  </NavLink>
);

export default function Sidebar(){
  return (
    <aside className="su-sidebar">
      <div style={{fontWeight:700, marginBottom:12}}>Menu</div>
      <NavItem to="/admin">Dashboard</NavItem>
      <NavItem to="/admin/settings">Settings</NavItem>
      <NavItem to="/admin/menus">Menus</NavItem>
      <NavItem to="/admin/headers">Headers</NavItem>
      <NavItem to="/admin/footers">Footers</NavItem>
      <NavItem to="/admin/users">Users</NavItem>
      <NavItem to="/admin/taxonomies">Taxonomies</NavItem>
      <NavItem to="/admin/content">Content</NavItem>
      <div style={{marginTop:16, opacity:.7}}>
        <NavItem to="/quick-builder">Quick Builder</NavItem>
      </div>
    </aside>
  );
}
