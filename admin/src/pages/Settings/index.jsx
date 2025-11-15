import React, { useEffect, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../lib/api';

export default function SettingsPage() {
  const { settings, setSettings, loading } = useSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (settings && !form) {
      // Clone to avoid mutating context directly
      setForm({
        appName: settings.appName || 'ServiceUp Admin',
        theme: {
          mode: settings.theme?.mode || 'light',
        },
        navSidebar: Array.isArray(settings.navSidebar)
          ? settings.navSidebar
          : [],
        navTopbarButtons: Array.isArray(settings.navTopbarButtons)
          ? settings.navTopbarButtons
          : [],
        dashboardWidgets: Array.isArray(settings.dashboardWidgets)
          ? settings.dashboardWidgets
          : settings.dashboardWidgets || [],
        // keep any other keys around
        ...settings,
      });
    }
  }, [settings, form]);

  function bind(path) {
    return (e) => {
      const value =
        e && e.target && e.target.type === 'checkbox'
          ? e.target.checked
          : e.target.value;
      setForm((prev) => {
        const next = { ...prev };
        const parts = path.split('.');
        let cur = next;
        for (let i = 0; i < parts.length - 1; i++) {
          const key = parts[i];
          cur[key] = cur[key] || {};
          cur = cur[key];
        }
        cur[parts[parts.length - 1]] = value;
        return next;
      });
    };
  }

  function updateNavSidebar(index, field, value) {
    setForm((prev) => {
      const nav = Array.isArray(prev.navSidebar) ? [...prev.navSidebar] : [];
      nav[index] = { ...(nav[index] || {}), [field]: value };
      return { ...prev, navSidebar: nav };
    });
  }

  function addSidebarItem() {
    setForm((prev) => ({
      ...prev,
      navSidebar: [
        ...(Array.isArray(prev.navSidebar) ? prev.navSidebar : []),
        { label: 'New link', to: '/admin' },
      ],
    }));
  }

  function removeSidebarItem(index) {
    setForm((prev) => {
      const nav = Array.isArray(prev.navSidebar) ? [...prev.navSidebar] : [];
      nav.splice(index, 1);
      return { ...prev, navSidebar: nav };
    });
  }

  function updateTopbar(index, field, value) {
    setForm((prev) => {
      const items = Array.isArray(prev.navTopbarButtons)
        ? [...prev.navTopbarButtons]
        : [];
      items[index] = { ...(items[index] || {}), [field]: value };
      return { ...prev, navTopbarButtons: items };
    });
  }

  function addTopbarItem() {
    setForm((prev) => ({
      ...prev,
      navTopbarButtons: [
        ...(Array.isArray(prev.navTopbarButtons)
          ? prev.navTopbarButtons
          : []),
        { label: 'New button', to: '/' },
      ],
    }));
  }

  function removeTopbarItem(index) {
    setForm((prev) => {
      const items = Array.isArray(prev.navTopbarButtons)
        ? [...prev.navTopbarButtons]
        : [];
      items.splice(index, 1);
      return { ...prev, navTopbarButtons: items };
    });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const saved = await api.post('/settings', form);
      setSettings(saved);
      setSavedMsg('Settings saved.');
    } catch (err) {
      console.error('Failed to save settings', err);
      setSavedMsg(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(''), 3000);
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
          Theme
          <select
            className="su-select"
            value={form.theme?.mode || 'light'}
            onChange={bind('theme.mode')}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
      </div>

      <div className="su-card" id="navigation">
        <h2>Navigation</h2>
        <h3 style={{ marginTop: 0 }}>Sidebar menu</h3>
        <div style={{ marginBottom: 8 }}>
          {(form.navSidebar || []).map((item, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <input
                className="su-input"
                placeholder="Label"
                value={item.label || ''}
                onChange={(e) =>
                  updateNavSidebar(i, 'label', e.target.value)
                }
              />
              <input
                className="su-input"
                placeholder="Path (e.g. /admin/content)"
                value={item.to || ''}
                onChange={(e) =>
                  updateNavSidebar(i, 'to', e.target.value)
                }
              />
              <button
                className="su-btn"
                type="button"
                onClick={() => removeSidebarItem(i)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="su-btn"
            type="button"
            onClick={addSidebarItem}
          >
            + Add sidebar link
          </button>
        </div>

        <h3>Topbar buttons</h3>
        <div>
          {(form.navTopbarButtons || []).map((item, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <input
                className="su-input"
                placeholder="Label"
                value={item.label || ''}
                onChange={(e) =>
                  updateTopbar(i, 'label', e.target.value)
                }
              />
              <input
                className="su-input"
                placeholder="Path (e.g. /quick-builder)"
                value={item.to || ''}
                onChange={(e) =>
                  updateTopbar(i, 'to', e.target.value)
                }
              />
              <button
                className="su-btn"
                type="button"
                onClick={() => removeTopbarItem(i)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="su-btn"
            type="button"
            onClick={addTopbarItem}
          >
            + Add topbar button
          </button>
        </div>
      </div>

      <div className="su-card" style={{ gridColumn: '1 / span 2' }}>
        <button
          className="su-btn primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {savedMsg && (
          <div style={{ marginTop: 8, opacity: 0.8 }}>{savedMsg}</div>
        )}
      </div>
    </div>
  );
}
