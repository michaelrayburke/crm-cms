import React, { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
// Import the API client only; we'll call api.put directly rather than using saveSettings
// Import both the API client and the helper to persist settings.
import { api, saveSettings } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Denver', label: 'America/Denver (MT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'UTC', label: 'UTC' },
];

const PAGE_OPTIONS = [
  { value: '/admin', label: 'Dashboard' },
  { value: '/admin/content', label: 'Content index' },
  { value: '/admin/users', label: 'Users' },
  { value: '/admin/taxonomies', label: 'Taxonomies' },
  { value: '/admin/menus', label: 'Menus' },
  { value: '/admin/headers', label: 'Headers' },
  { value: '/admin/footers', label: 'Footers' },
  { value: '/admin/settings', label: 'Settings' },
];

export default function SettingsPage() {
  const { settings, setSettings, loading } = useSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [roles, setRoles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Bootstrap from context settings
  useEffect(() => {
    if (settings && !form) {
      setForm({
        appName: settings.appName || 'ServiceUp Admin',
        theme: {
          mode: settings.theme?.mode || 'light',
        },
        timezone: settings.timezone || 'America/Los_Angeles',
        logoUrl: settings.logoUrl || '',
        faviconUrl: settings.faviconUrl || '',
        appIconUrl: settings.appIconUrl || '',
        poweredByText: settings.poweredByText || '',
        poweredByUrl: settings.poweredByUrl || '',
        navSidebar: Array.isArray(settings.navSidebar) ? settings.navSidebar : [],
        navTopbarButtons: Array.isArray(settings.navTopbarButtons)
          ? settings.navTopbarButtons
          : [],
        dashboardWidgets: Array.isArray(settings.dashboardWidgets)
          ? settings.dashboardWidgets
          : settings.dashboardWidgets || [],
        // keep any other server-provided keys around
        ...settings,
      });
    }
  }, [settings, form]);

  // Load role options for nav visibility controls
  useEffect(() => {
    async function loadRoles() {
      try {
        const res = await api.get('/api/roles');
        if (Array.isArray(res)) {
          setRoles(res);
        } else if (Array.isArray(res.roles)) {
          setRoles(res.roles);
        }
      } catch (err) {
        console.error('[Settings] Failed to load roles', err);
      }
    }
    loadRoles();
  }, []);

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.slug, label: r.label || r.slug })),
    [roles],
  );

  function bind(path) {
    return (e) => {
      const value =
        e && e.target && e.target.type === 'checkbox' ? e.target.checked : e.target.value;
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

  function updateTopbar(index, field, value) {
    setForm((prev) => {
      const items = Array.isArray(prev.navTopbarButtons) ? [...prev.navTopbarButtons] : [];
      items[index] = { ...(items[index] || {}), [field]: value };
      return { ...prev, navTopbarButtons: items };
    });
  }

  function addSidebarItem() {
    setForm((prev) => ({
      ...prev,
      navSidebar: [
        ...(Array.isArray(prev.navSidebar) ? prev.navSidebar : []),
        { label: 'New link', to: '/admin', roles: [] },
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

  function addTopbarItem() {
    setForm((prev) => ({
      ...prev,
      navTopbarButtons: [
        ...(Array.isArray(prev.navTopbarButtons) ? prev.navTopbarButtons : []),
        { label: 'New button', to: '/admin', roles: [] },
      ],
    }));
  }

  function removeTopbarItem(index) {
    setForm((prev) => {
      const items = Array.isArray(prev.navTopbarButtons) ? [...prev.navTopbarButtons] : [];
      items.splice(index, 1);
      return { ...prev, navTopbarButtons: items };
    });
  }

  function handleMultiRoleChange(kind, index, event) {
    const selected = Array.from(event.target.selectedOptions).map((opt) => opt.value);
    if (kind === 'sidebar') {
      updateNavSidebar(index, 'roles', selected);
    } else {
      updateTopbar(index, 'roles', selected);
    }
  }

  async function uploadBrandingFile(e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!supabase) {
      console.warn('[Settings] Supabase client not configured');
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.split('.').pop() || 'png';
      const path = `${field}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('branding').upload(path, file, {
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('branding').getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error('No public URL returned from Supabase');

      setForm((prev) => ({
        ...prev,
        [field]: publicUrl,
      }));
      setSavedMsg('Uploaded file. Remember to save settings.');
    } catch (err) {
      console.error('[Settings] uploadBrandingFile failed', err);
      alert('File upload failed. Check the console for details.');
    } finally {
      setUploading(false);
      // reset value so the same file can be selected again
      e.target.value = '';
    }
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const payload = {
        ...form,
        theme: {
          mode: form.theme?.mode || 'light',
        },
      };
      // Persist settings using the saveSettings helper which computes the correct path
      const saved = await saveSettings(payload);
      const nextSettings = saved || payload;
      setSettings(nextSettings);
      setSavedMsg('Settings saved.');
    } catch (err) {
      console.error('[Settings] Failed to save settings', err);
      setSavedMsg('Failed to save. See console for details.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !form) {
    return <div className="p-6">Loading settings…</div>;
  }

  if (!form) {
    return <div className="p-6">No settings loaded.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{form.appName || 'ServiceUp Admin'}</h1>
          <p className="text-sm text-gray-500">
            Configure the admin experience, branding, and navigation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr),minmax(0,1.2fr)] gap-6 items-start">
        {/* Left column: General + Branding */}
        <div className="space-y-4">
          <section className="su-card">
            <h2 className="su-card-title">General</h2>
            <div className="space-y-3">
              <div>
                <label className="su-label">App name</label>
                <input className="su-input" value={form.appName} onChange={bind('appName')} />
              </div>

              <div>
                <label className="su-label">Theme</label>
                <select
                  className="su-select"
                  value={form.theme?.mode || 'light'}
                  onChange={bind('theme.mode')}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div>
                <label className="su-label">Timezone</label>
                <select
                  className="su-select"
                  value={form.timezone || 'America/Los_Angeles'}
                  onChange={bind('timezone')}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="su-card">
            <h2 className="su-card-title">Branding</h2>
            <div className="space-y-3">
              <div>
                <label className="su-label">Logo URL</label>
                <div className="flex gap-2">
                  <input
                    className="su-input"
                    placeholder="https://…/logo.png"
                    value={form.logoUrl || ''}
                    onChange={bind('logoUrl')}
                  />
                  <label className="su-btn">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => uploadBrandingFile(e, 'logoUrl')}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="su-label">Favicon URL</label>
                <div className="flex gap-2">
                  <input
                    className="su-input"
                    placeholder="https://…/favicon.ico"
                    value={form.faviconUrl || ''}
                    onChange={bind('faviconUrl')}
                  />
                  <label className="su-btn">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => uploadBrandingFile(e, 'faviconUrl')}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="su-label">App icon URL</label>
                <div className="flex gap-2">
                  <input
                    className="su-input"
                    placeholder="https://…/app-icon.png"
                    value={form.appIconUrl || ''}
                    onChange={bind('appIconUrl')}
                  />
                  <label className="su-btn">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => uploadBrandingFile(e, 'appIconUrl')}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="su-label">Powered-by text</label>
                <input
                  className="su-input"
                  placeholder="serviceup / bmp"
                  value={form.poweredByText || ''}
                  onChange={bind('poweredByText')}
                />
              </div>

              <div>
                <label className="su-label">Powered-by URL</label>
                <input
                  className="su-input"
                  placeholder="https://burkemedia.pro/"
                  value={form.poweredByUrl || ''}
                  onChange={bind('poweredByUrl')}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right column: Navigation */}
        <section className="su-card">
          <h2 className="su-card-title">Navigation</h2>

          {/* Sidebar menu */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Sidebar menu</h3>
              <button type="button" className="su-btn" onClick={addSidebarItem}>
                + Add sidebar link
              </button>
            </div>

            {!form.navSidebar || form.navSidebar.length === 0 ? (
              <p className="text-xs text-gray-500">
                No sidebar items yet. Add links for the left-hand menu.
              </p>
            ) : null}

            <div className="space-y-3">
              {form.navSidebar?.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] gap-2 items-center">
                    <input
                      className="su-input"
                      placeholder="Label"
                      value={item.label || ''}
                      onChange={(e) => updateNavSidebar(i, 'label', e.target.value)}
                    />
                    <select
                      className="su-select"
                      value={item.to || ''}
                      onChange={(e) => updateNavSidebar(i, 'to', e.target.value)}
                    >
                      <option value="">Custom URL…</option>
                      {PAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="su-btn" onClick={() => removeSidebarItem(i)}>
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr)] gap-2 items-center">
                    <input
                      className="su-input"
                      placeholder="Or type a custom path (e.g. /admin/custom)"
                      value={item.to || ''}
                      onChange={(e) => updateNavSidebar(i, 'to', e.target.value)}
                    />
                    <select
                      multiple
                      className="su-select"
                      value={item.roles || []}
                      onChange={(e) => handleMultiRoleChange('sidebar', i, e)}
                    >
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-gray-500">Roles: leave empty to show to all roles.</p>
                </div>
              ))}
            </div>
          </div>

          {/* Topbar buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Topbar buttons</h3>
              <button type="button" className="su-btn" onClick={addTopbarItem}>
                + Add topbar button
              </button>
            </div>

            {!form.navTopbarButtons || form.navTopbarButtons.length === 0 ? (
              <p className="text-xs text-gray-500">
                No topbar buttons yet. Add quick links for the top-right area.
              </p>
            ) : null}

            <div className="space-y-3">
              {form.navTopbarButtons?.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] gap-2 items-center">
                    <input
                      className="su-input"
                      placeholder="Label"
                      value={item.label || ''}
                      onChange={(e) => updateTopbar(i, 'label', e.target.value)}
                    />
                    <select
                      className="su-select"
                      value={item.to || ''}
                      onChange={(e) => updateTopbar(i, 'to', e.target.value)}
                    >
                      <option value="">Custom URL…</option>
                      {PAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="su-btn" onClick={() => removeTopbarItem(i)}>
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr)] gap-2 items-center">
                    <input
                      className="su-input"
                      placeholder="Or type a custom path (e.g. /admin/custom)"
                      value={item.to || ''}
                      onChange={(e) => updateTopbar(i, 'to', e.target.value)}
                    />
                    <select
                      multiple
                      className="su-select"
                      value={item.roles || []}
                      onChange={(e) => handleMultiRoleChange('topbar', i, e)}
                    >
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-gray-500">Roles: leave empty to show to all roles.</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div>
        <button className="su-btn primary" onClick={save} disabled={saving || uploading}>
          {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save settings'}
        </button>
        {savedMsg && <span className="ml-3 text-sm text-gray-600">{savedMsg}</span>}
      </div>
    </div>
  );
}