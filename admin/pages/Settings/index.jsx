import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../lib/api';

export default function SettingsPage(){
  const { settings, setSettings } = useSettings();
  const [form, setForm] = useState(settings || {});
  const [saving, setSaving] = useState(false);

  const bind = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const bindTheme = (k) => (e) => setForm({ ...form, theme:{...form.theme, [k]: e.target.value} });
  const bindRoleHide = (role) => (e) => setForm({ ...form, hideChromeByRole:{...form.hideChromeByRole, [role]: e.target.checked} });

  async function save(){
    setSaving(true);
    try{
      const updated = await api.post('/settings', form);
      setSettings(updated);
      alert('Saved ✓');
    }catch(e){ alert('Could not save: ' + e.message); }
    finally{ setSaving(false); }
  }

  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <h2>General</h2>
        <label>Timezone
          <input className="su-input" value={form.timezone||''} onChange={bind('timezone')} placeholder="America/Los_Angeles" />
        </label>
        <div style={{height:8}}/>
        <label>Powered by
          <input className="su-input" value={form.poweredBy||''} onChange={bind('poweredBy')} placeholder="serviceup / bmp" />
        </label>
        <div style={{height:8}}/>
        <label>Sidebar (JSON)
          <textarea className="su-textarea" rows={8}
            value={JSON.stringify(form.nav || [], null, 2)}
            onChange={e=>{
              try {
                const parsed = JSON.parse(e.target.value);
                setForm({...form, nav: parsed});
              } catch {
                // ignore parse errors while typing
              }
            }} />
          <small style={{color:'var(--su-muted)'}}>Array of items: [{{"label":"Dashboard","to":"/admin"}}, …]</small>
        </label>
        <div style={{height:8}}/>
        <button className="su-btn primary" disabled={saving} onClick={save}>Save</button>
      </div>
      <div className="su-card">
        <h2>Branding</h2>
        <label>Logo URL <input className="su-input" value={form.logoUrl||''} onChange={bind('logoUrl')} /></label>
        <div style={{height:8}}/>
        <label>Favicon URL <input className="su-input" value={form.faviconUrl||''} onChange={bind('faviconUrl')} /></label>
        <div style={{height:8}}/>
        <label>App Icon URL <input className="su-input" value={form.appIconUrl||''} onChange={bind('appIconUrl')} /></label>
      </div>
      <div className="su-card">
        <h2>Theme</h2>
        <label>Mode
          <select className="su-select" value={form.theme?.mode||'light'} onChange={bindTheme('mode')}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div style={{height:8}}/>
        <label>Primary <input className="su-input" value={form.theme?.primary||''} onChange={bindTheme('primary')} placeholder="#000000" /></label>
      </div>
      <div className="su-card">
        <h2>Visibility</h2>
        {['ADMIN','EDITOR','VIEWER'].map(r => (
          <label key={r} style={{display:'block', marginBottom:6}}>
            <input type="checkbox" checked={!!form.hideChromeByRole?.[r]} onChange={bindRoleHide(r)} />
            <span style={{marginLeft:8}}>Hide admin chrome for {r}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
