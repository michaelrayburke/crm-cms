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

  // ESC closes sidebar
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Body class for mobile slide-in
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('su-sidebar-open');
    } else {
      document.body.classList.remove('su-sidebar-open');
    }
  }, [sidebarOpen]);

  if (hideChrome) {
    // Viewer / embed mode
    return <main className="su-content">{children}</main>;
  }

  return (
    <div className={`su-layout${collapsed ? ' collapsed' : ''}`}>
      <Sidebar onClose={closeSidebar} role={role} />

      <Topbar
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        isSidebarOpen={sidebarOpen}
        role={role}
      />

      <main className="su-content">{children}</main>

      <Footer />

      {/* No backdrop anymore – just the sliding panel */}
    </div>
  );
}
