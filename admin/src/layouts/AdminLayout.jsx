import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Footer from '../components/Footer';
import { useSettings } from '../context/SettingsContext';

export default function AdminLayout({ children, role='ADMIN' }){
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useSettings();
  const hideChrome = settings?.hideChromeByRole?.[role];

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(()=>{
    function onKey(e){
      if(e.key === 'Escape') closeSidebar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSidebar]);

  if(hideChrome){
    return <div className="su-content">{children}</div>;
  }

  return (
    <div className={'su-layout' + (collapsed ? ' collapsed' : '')}>
      <div className={ 'su-sidebar ' + (sidebarOpen ? 'open' : '') }>
        <Sidebar />
      </div>
      <Topbar onToggleSidebar={()=> setSidebarOpen(v => !v)} />
      <main className="su-content">{children}</main>
      <Footer />
      {sidebarOpen && <div className="su-backdrop" onClick={closeSidebar} aria-hidden="true" />}
    </div>
  );
}
