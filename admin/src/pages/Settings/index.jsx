import React, { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api, saveSettings } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';

// Hard-coded list of timezones for convenience.  Could be moved to a
// separate constants file if reused elsewhere.
const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Denver', label: 'America/Denver (MT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'UTC', label: 'UTC' },
];

// List of admin pages used to prefill the page dropdown in the navigation
// builder UI.  If you add new admin routes, consider adding them here.
// List of pages that can be selected in the page dropdowns when building
// navigation items.  This includes all top-level admin pages and any
// nested settings pages that have explicit routes.  When new settings
// sub-routes are added (e.g. `/admin/settings/xyz`), consider adding
// them here so they appear in the dropdown.  Dynamic segments (like
// `:typeSlug` or `:viewSlug`) should be handled via the custom path
// field instead of being enumerated here.
const PAGE_OPTIONS = [
  { value: '/admin', label: 'Dashboard' },
  { value: '/admin/content', label: 'Content index' },
  { value: '/admin/users', label: 'Users' },
  { value: '/admin/taxonomies', label: 'Taxonomies' },
  { value: '/admin/menus', label: 'Menus' },
  { value: '/admin/headers', label: 'Headers' },
  { value: '/admin/footers', label: 'Footers' },
  // Quick Builder sits at the root of the admin; include it for easy selection.
  { value: '/admin/quick-builder', label: 'Quick Builder' },
  // Settings and its subpages
  { value: '/admin/settings', label: 'Settings' },
  { value: '/admin/settings/roles', label: 'Roles (Settings)' },
  { value: '/admin/settings/dashboards', label: 'Dashboards (Settings)' },
  { value: '/admin/settings/permissions', label: 'Permissions (Settings)' },
  { value: '/admin/settings/entry-views', label: 'Entry Views (Settings)' },
  { value: '/admin/settings/list-views', label: 'List Views (Settings)' },
];

// Target options for links.  These control whether a link opens in the same
// window/tab, a new tab, or a new window entirely.
const TARGET_OPTIONS = [
  { value: '_self', label: 'Same window (default)' },
  { value: '_blank', label: 'New tab / window' },
  { value: '_top', label: 'New window (top)' },
];

/**
 * SettingsPage allows administrators to configure the app branding,
 * navigation structure and other high-level settings.  It loads the
 * existing settings from context and merges them with local state while
 * editing.  When saved, the new settings are persisted via the API.
 */
export default function SettingsPage() {
  const { settings, setSettings, loading } = useSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [roles, setRoles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Initialize the form from context settings only once.  Additional keys
  // from the server are preserved via the spread operator.
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
        // copy over any additional keys from the server response
        ...settings,
      });
    }
  }, [settings, form]);

  // Load roles once to populate the multi-select for nav visibility.
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

  // Transform roles into options for the multi-select.
  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.slug, label: r.label || r.slug })),
    [roles]
  );

  // Bind a setting path to an input change handler.  Supports nested paths
  // (e.g. 'theme.mode') by splitting on dots and walking the object.
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

  // Helper functions to update the navigation structures.
  function updateNavSidebar(index, field, value) {
    setForm((prev) => {
      const nav = Array.isArray(prev.navSidebar) ? [...prev.navSidebar] : [];
      nav[index] = { ...(nav[index] || {}), [field]: value };
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
  function addSidebarItem() {
    setForm((prev) => ({
      ...prev,
      navSidebar: [
        ...(Array.isArray(prev.navSidebar) ? prev.navSidebar : []),
        { label: 'New link', to: '/admin', roles: [], target: '_self' },
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
        { label: 'New button', to: '/admin', roles: [], target: '_self' },
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
  function handleMultiRoleChange(kind, index, event) {
    const selected = Array.from(event.target.selectedOptions).map(
      (opt) => opt.value
    );
    if (kind === 'sidebar') {
      updateNavSidebar(index, 'roles', selected);
    } else {
      updateTopbar(index, 'roles', selected);
    }
  }
  // Sidebar children helpers
  function addSidebarChild(parentIndex) {
    setForm((prev) => {
      const nav = Array.isArray(prev.navSidebar) ? [...prev.navSidebar] : [];
      const parent = nav[parentIndex] || {};
      const children = Array.isArray(parent.children) ? [...parent.children] : [];
      children.push({ label: 'Child link', to: '/admin', target: '_self', roles: [] });
      nav[parentIndex] = { ...parent, children };
      return { ...prev, navSidebar: nav };
    });
  }
  function updateSidebarChild(parentIndex, childIndex, field, value) {
    setForm((prev) => {
      const nav = Array.isArray(prev.navSidebar) ? [...prev.navSidebar] : [];
      const parent = nav[parentIndex] || {};
      const children = Array.isArray(parent.children) ? [...parent.children] : [];
      children[childIndex] = { ...(children[childIndex] || {}), [field]: value };
      nav[parentIndex] = { ...parent, children };
      return { ...prev, navSidebar: nav };
    });
  }
  function removeSidebarChild(parentIndex, childIndex) {
    setForm((prev) => {
      const nav = Array.isArray(prev.navSidebar) ? [...prev.navSidebar] : [];
      const parent = nav[parentIndex] || {};
      const children = Array.isArray(parent.children) ? [...parent.children] : [];
      children.splice(childIndex, 1);
      nav[parentIndex] = { ...parent, children };
      return { ...prev, navSidebar: nav };
    });
  }
  // Topbar children helpers
  function addTopbarChild(parentIndex) {
    setForm((prev) => {
      const list = Array.isArray(prev.navTopbarButtons) ? [...prev.navTopbarButtons] : [];
      const parent = list[parentIndex] || {};
      const children = Array.isArray(parent.children) ? [...parent.children] : [];
      children.push({ label: 'Child link', to: '/admin', target: '_self', roles: [] });
      list[parentIndex] = { ...parent, children };
      return { ...prev, navTopbarButtons: list };
    });
  }
  function updateTopbarChild(parentIndex, childIndex, field, value) {
    setForm((prev) => {
      const list = Array.isArray(prev.navTopbarButtons) ? [...prev.navTopbarButtons] : [];
      const parent = list[parentIndex] || {};
      const children = Array.isArray(parent.children) ? [...parent.children] : [];
      children[childIndex] = { ...(children[childIndex] || {}), [field]: value };
      list[parentIndex] = { ...parent, children };
      return { ...prev, navTopbarButtons: list };
    });
  }
  function removeTopbarChild(parentIndex, childIndex) {
    setForm((prev) => {
      const list = Array.isArray(prev.navTopbarButtons) ? [...prev.navTopbarButtons] : [];
      const parent = list[parentIndex] || {};
      const children = Array.isArray(parent.children) ? [...parent.children] : [];
      children.splice(childIndex, 1);
      list[parentIndex] = { ...parent, children };
      return { ...prev, navTopbarButtons: list };
    });
  }
  // File upload helper for logo, favicon, etc.  Uses Supabase storage.
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
      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(path, file, {
          upsert: true,
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('branding').getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error('No public URL returned from Supabase');
      setForm((prev) => ({ ...prev, [field]: publicUrl }));
      setSavedMsg('Uploaded file. Remember to save settings.');
    } catch (err) {
      console.error('[Settings] uploadBrandingFile failed', err);
      alert('File upload failed. Check the console for details.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }
  // Save the current form via API.  Utilises saveSettings helper from
  // ../../lib/api which posts to /api/settings.
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
          <h1 className="text-2xl font-semibold mb-1">
            {form.appName || 'ServiceUp Admin'}
          </h1>
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
                <input
                  className="su-input"
                  value={form.appName}
                  onChange={bind('appName')}
                />
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
          {/* Sidebar menu editor */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Sidebar menu</h3>
              <button
                type="button"
                className="su-btn"
                onClick={addSidebarItem}
              >
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
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-3 space-y-2"
                >
                  {/* Parent fields */}
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
                    <button
                      type="button"
                      className="su-btn"
                      onClick={() => removeSidebarItem(i)}
                    >
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
                  <p className="text-[11px] text-gray-500">
                    Roles: leave empty to show to all roles.
                  </p>
                  <div className="mt-1">
                    <label className="su-label text-xs">Link target</label>
                    <select
                      className="su-select"
                      value={item.target || '_self'}
                      onChange={(e) => updateNavSidebar(i, 'target', e.target.value)}
                    >
                      {TARGET_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500">
                      Controls how this parent link opens when clicked.
                    </p>
                  </div>
                  {/* Children editor */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">
                        Child links (submenu)
                      </span>
                      <button
                        type="button"
                        className="su-btn"
                        onClick={() => addSidebarChild(i)}
                      >
                        + Add child link
                      </button>
                    </div>
                    {Array.isArray(item.children) && item.children.length > 0 && (
                      <div className="space-y-2">
                        {item.children.map((child, ci) => (
                          <div key={ci} className="space-y-2 pl-2">
                            <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] gap-2 items-center">
                              <input
                                className="su-input"
                                placeholder="Child label"
                                value={child.label || ''}
                                onChange={(e) => updateSidebarChild(i, ci, 'label', e.target.value)}
                              />
                              <select
                                className="su-select"
                                value={child.to || ''}
                                onChange={(e) => updateSidebarChild(i, ci, 'to', e.target.value)}
                              >
                                <option value="">Custom URL…</option>
                                {PAGE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="su-btn"
                                onClick={() => removeSidebarChild(i, ci)}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1fr)] gap-2 items-center">
                              <input
                                className="su-input"
                                placeholder="Or type a custom path (e.g. /admin/settings/branding)"
                                value={child.to || ''}
                                onChange={(e) => updateSidebarChild(i, ci, 'to', e.target.value)}
                              />
                              <select
                                className="su-select"
                                value={child.target || '_self'}
                                onChange={(e) => updateSidebarChild(i, ci, 'target', e.target.value)}
                              >
                                {TARGET_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                multiple
                                className="su-select"
                                value={child.roles || []}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                                  updateSidebarChild(i, ci, 'roles', selected);
                                }}
                              >
                                {roleOptions.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500">
                      If you add child links, this item becomes a parent section with a
                      collapsible submenu in the sidebar.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Topbar buttons editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Topbar buttons</h3>
              <button
                type="button"
                className="su-btn"
                onClick={addTopbarItem}
              >
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
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-3 space-y-2"
                >
                  {/* Parent fields */}
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
                    <button
                      type="button"
                      className="su-btn"
                      onClick={() => removeTopbarItem(i)}
                    >
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
                  <p className="text-[11px] text-gray-500">
                    Roles: leave empty to show to all roles.
                  </p>
                  <div className="mt-1">
                    <label className="su-label text-xs">Link target</label>
                    <select
                      className="su-select"
                      value={item.target || '_self'}
                      onChange={(e) => updateTopbar(i, 'target', e.target.value)}
                    >
                      {TARGET_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500">
                      Controls how this button opens its link.
                    </p>
                  </div>
                  {/* Children editor */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">
                        Child links (dropdown)
                      </span>
                      <button
                        type="button"
                        className="su-btn"
                        onClick={() => addTopbarChild(i)}
                      >
                        + Add child link
                      </button>
                    </div>
                    {Array.isArray(item.children) && item.children.length > 0 && (
                      <div className="space-y-2">
                        {item.children.map((child, ci) => (
                          <div key={ci} className="space-y-2 pl-2">
                            <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] gap-2 items-center">
                              <input
                                className="su-input"
                                placeholder="Child label"
                                value={child.label || ''}
                                onChange={(e) => updateTopbarChild(i, ci, 'label', e.target.value)}
                              />
                              <select
                                className="su-select"
                                value={child.to || ''}
                                onChange={(e) => updateTopbarChild(i, ci, 'to', e.target.value)}
                              >
                                <option value="">Custom URL…</option>
                                {PAGE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="su-btn"
                                onClick={() => removeTopbarChild(i, ci)}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1fr)] gap-2 items-center">
                              <input
                                className="su-input"
                                placeholder="Or type a custom path (e.g. /admin/help/docs)"
                                value={child.to || ''}
                                onChange={(e) => updateTopbarChild(i, ci, 'to', e.target.value)}
                              />
                              <select
                                className="su-select"
                                value={child.target || '_self'}
                                onChange={(e) => updateTopbarChild(i, ci, 'target', e.target.value)}
                              >
                                {TARGET_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                multiple
                                className="su-select"
                                value={child.roles || []}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                                  updateTopbarChild(i, ci, 'roles', selected);
                                }}
                              >
                                {roleOptions.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500">
                      If you add child links, this item becomes a dropdown in the top bar.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div>
        <button
          className="su-btn primary"
          onClick={save}
          disabled={saving || uploading}
        >
          {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save settings'}
        </button>
        {savedMsg && (
          <span className="ml-3 text-sm text-gray-600">{savedMsg}</span>
        )}
      </div>
    </div>
  );
}