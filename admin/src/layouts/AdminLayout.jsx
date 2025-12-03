import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Footer from '../components/Footer';
import { useSettings } from '../context/SettingsContext';

export default function AdminLayout({ children, role = 'ADMIN' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useSettings();
  const hideChrome = settings?.hideChromeByRole?.[role];

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Close sidebar with ESC key
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sync body class so the mobile CSS (body.su-sidebar-open .su-sidebar) works
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('su-sidebar-open');
    } else {
      document.body.classList.remove('su-sidebar-open');
    }
  }, [sidebarOpen]);

  if (hideChrome) {
    // Viewer / embed mode – no sidebar/topbar/footer
    return <main className="su-content">{children}</main>;
  }

  return (
    <div className={`su-layout${collapsed ? ' collapsed' : ''}`}>
      {/* Sidebar lives directly in the layout grid */}
      <Sidebar />

      {/* Topbar gets handlers for hamburger + collapse */}
      <Topbar
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        isSidebarOpen={sidebarOpen}
        isCollapsed={collapsed}
      />

      <main className="su-content">{children}</main>

      <Footer />

      {sidebarOpen && (
        <div
          className="su-backdrop"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
