import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../lib/api';

export default function SettingsPage() {
  const { settings, setSettings, loading } = useSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (settings && !form) {
      setForm(settings);
    }
  }, [settings, form]);

  const bind = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const bindTheme = (key) => (e) =>
    setForm((prev) => ({
      ...prev,
      theme: { ...(prev.theme || {}), [key]: e.target.value },
    }));

  const bindRoleHide = (role) => (e) =>
    setForm((prev) => ({
      ...prev,
      hideChromeByRole: {
        ...(prev.hideChromeByRole || {}),
        [role]: e.target.checked,
      },
    }));

  async function save() {
    if (!form) return;
    setSaving(true);
    setSavedMsg('');
    try {
      // Fallback for older api helpers that don't support .put
      const updated = typeof api.put === 'function'
        ? await api.put('/settings', form)
        : await api.post('/settings', form);

      setSettings(updated);
      const mode = updated?.theme?.mode || 'light';
      document.documentElement.setAttribute('data-theme', mode);
      setSavedMsg('Settings saved.');
    } catch (e) {
      console.error(e);
      setSavedMsg('Error saving settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(''), 2500);
    }
  }

  if (loading || !form) {
    return <div className="su-card">Loading settings…</div>;
  }

  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <h2>General</h2>
        <label>
          App name
          <input
            className="su-input"
            value={form.appName || ''}
            onChange={bind('appName')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Timezone
          <input
            className="su-input"
            value={form.timezone || ''}
            onChange={bind('timezone')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Powered by line
          <input
            className="su-input"
            value={form.poweredBy || ''}
            onChange={bind('poweredBy')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Logo URL
          <input
            className="su-input"
            value={form.logoUrl || ''}
            onChange={bind('logoUrl')}
          />
        </label>
      </div>

      <div className="su-card">
        <h2>Theme</h2>
        <label>
          Mode
          <select
            className="su-select"
            value={form.theme?.mode || 'light'}
            onChange={bindTheme('mode')}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div style={{ height: 8 }} />
        <label>
          Primary color
          <input
            type="color"
            value={form.theme?.primary || '#000000'}
            onChange={bindTheme('primary')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Surface color
          <input
            type="color"
            value={form.theme?.surface || '#ffffff'}
            onChange={bindTheme('surface')}
          />
        </label>
        <div style={{ height: 8 }} />
        <label>
          Text color
          <input
            type="color"
            value={form.theme?.text || '#111111'}
            onChange={bindTheme('text')}
          />
        </label>
      </div>

      <div className="su-card">
        <h2>Visibility (Hide Admin Chrome)</h2>
        {['ADMIN', 'EDITOR', 'VIEWER'].map((role) => (
          <label key={role} style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={!!form.hideChromeByRole?.[role]}
              onChange={bindRoleHide(role)}
            />{' '}
            <span style={{ marginLeft: 8 }}>
              Hide sidebar/topbar/footer for {role}
            </span>
          </label>
        ))}
      </div>

      <div className="su-card">
        <h2>Save</h2>
        <button
          className="su-btn primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {savedMsg && (
          <div style={{ marginTop: 8, opacity: 0.75 }}>{savedMsg}</div>
        )}
      </div>
    </div>
  );
}
