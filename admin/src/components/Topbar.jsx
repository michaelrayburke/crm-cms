import React from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

export default function Topbar({onToggleSidebar}){
  const { settings } = useSettings();
  return (
    <header className="su-topbar">
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <button className="su-btn" onClick={onToggleSidebar} aria-label="Toggle menu" aria-controls="admin-sidebar" aria-expanded="false">☰</button>
        <img src={settings?.logoUrl || '/assets/logo.svg'} alt="" style={{height:28}} />
        <strong>{settings?.appName || 'Business name'}</strong>
      </div>
      <nav style={{display:'flex', alignItems:'center', gap:12}}>
        <Link className="su-btn" to="/site">view site/app/custom link</Link>
        <Link className="su-btn" to="/new">view/add/custom link</Link>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span>hello, user!</span>
          <div style={{width:28,height:28,borderRadius:'50%',background:'#4f8bff'}} />
        </div>
      </nav>
    </header>
  );
}
