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
  
  const sidebarItems = Array.isArray(form?.navSidebar)
    ? form.navSidebar
    : [];

  function addSidebarItem() {
    setForm((prev) => ({
      ...prev,
      navSidebar: [
        ...(Array.isArray(prev.navSidebar) ? prev.navSidebar : []),
        { label: 'New item', to: '/admin' },
      ],
    }));
  }

  function updateSidebarItem(index, key, value) {
    setForm((prev) => {
      const items = Array.isArray(prev.navSidebar)
        ? [...prev.navSidebar]
        : [];
      items[index] = { ...(items[index] || {}), [key]: value };
      return { ...prev, navSidebar: items };
    });
  }

  function removeSidebarItem(index) {
    setForm((prev) => {
      const items = Array.isArray(prev.navSidebar)
        ? [...prev.navSidebar]
        : [];
      items.splice(index, 1);
      return { ...prev, navSidebar: items };
    });
  }

  const topbarButtons = Array.isArray(form?.navTopbarButtons)
    ? form.navTopbarButtons
    : [];

  function addTopbarButton() {
    setForm((prev) => ({
      ...prev,
      navTopbarButtons: [
        ...(Array.isArray(prev.navTopbarButtons)
          ? prev.navTopbarButtons
          : []),
        { label: 'Quick Builder', to: '/quick-builder' },
      ],
    }));
  }

  function updateTopbarButton(index, key, value) {
    setForm((prev) => {
      const items = Array.isArray(prev.navTopbarButtons)
        ? [...prev.navTopbarButtons]
        : [];
      items[index] = { ...(items[index] || {}), [key]: value };
      return { ...prev, navTopbarButtons: items };
    });
  }

  function removeTopbarButton(index) {
    setForm((prev) => {
      const items = Array.isArray(prev.navTopbarButtons)
        ? [...prev.navTopbarButtons]
        : [];
      items.splice(index, 1);
      return { ...prev, navTopbarButtons: items };
    });
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

      <div className="su-card" id="navigation">
        <h2>Navigation</h2>
        <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
          Control sidebar menu items and topbar buttons. If you leave a list empty,
          defaults will be used.
        </p>

        <h3 style={{ marginTop: 0 }}>Sidebar menu</h3>
        {sidebarItems.length === 0 && (
          <p style={{ fontSize: 12, opacity: 0.7 }}>
            No custom sidebar items. Defaults will be shown.
          </p>
        )}
        {sidebarItems.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 8,
              alignItems: 'center',
            }}
          >
            <input
              className="su-input"
              style={{ flex: 1 }}
              placeholder="Label"
              value={item.label || ''}
              onChange={(e) =>
                updateSidebarItem(index, 'label', e.target.value)
              }
            />
            <input
              className="su-input"
              style={{ flex: 1 }}
              placeholder="Path, e.g. /admin/content"
              value={item.to || ''}
              onChange={(e) => updateSidebarItem(index, 'to', e.target.value)}
            />
            <button
              type="button"
              className="su-btn"
              onClick={() => removeSidebarItem(index)}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="su-btn"
          onClick={addSidebarItem}
          style={{ marginTop: 4 }}
        >
          + Add sidebar link
        </button>

        <div style={{ height: 16 }} />

        <h3>Topbar buttons</h3>
        {topbarButtons.length === 0 && (
          <p style={{ fontSize: 12, opacity: 0.7 }}>
            No custom topbar buttons. Defaults will be used (Quick Builder).
          </p>
        )}
        {topbarButtons.map((btn, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 8,
              alignItems: 'center',
            }}
          >
            <input
              className="su-input"
              style={{ flex: 1 }}
              placeholder="Label"
              value={btn.label || ''}
              onChange={(e) =>
                updateTopbarButton(index, 'label', e.target.value)
              }
            />
            <input
              className="su-input"
              style={{ flex: 1 }}
              placeholder="Path, e.g. /quick-builder"
              value={btn.to || ''}
              onChange={(e) =>
                updateTopbarButton(index, 'to', e.target.value)
              }
            />
            <button
              type="button"
              className="su-btn"
              onClick={() => removeTopbarButton(index)}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="su-btn"
          onClick={addTopbarButton}
          style={{ marginTop: 4 }}
        >
          + Add topbar button
        </button>
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
