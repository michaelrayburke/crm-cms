import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listViewsVersion, setListViewsVersion] = useState(0);

  const bumpListViewsVersion = () => {
    setListViewsVersion((v) => v + 1);
  };

  // 1) Load settings once
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/settings');
        setSettings(data);

        const mode = data?.theme?.mode || 'light';
        document.documentElement.setAttribute('data-theme', mode);
      } catch (e) {
        console.warn('Failed to load settings, using defaults', e);

        const fallback = {
          app_name: 'ServiceUp',
          timezone: 'America/Los_Angeles',
          poweredBy: 'serviceup / bmp',
          theme: {
            mode: 'light',
            primary: '#000000',
            surface: '#ffffff',
            text: '#111111',
          },
          logoUrl: '/assets/logo.svg',
          faviconUrl: '/assets/favicon.ico',
          appIconUrl: '/assets/app-icon.png',
          hideChromeByRole: {
            VIEWER: false,
            EDITOR: false,
            ADMIN: false,
          },
        };

        setSettings(fallback);
        document.documentElement.setAttribute('data-theme', fallback.theme.mode);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2) Apply brand + metadata whenever settings changes
  useEffect(() => {
    if (!settings) return;

    const theme = settings?.theme || {};

    // --- Title ---
    const title = settings?.app_name || settings?.name || 'ServiceUp';
    document.title = title;

    // --- CSS token sync (DB -> CSS variables) ---
    const root = document.documentElement;

    // These map to your token-first theme.css approach
    if (theme.primary) root.style.setProperty('--su-accent', theme.primary);
    if (theme.surface) root.style.setProperty('--su-surface', theme.surface);
    if (theme.text) root.style.setProperty('--su-text', theme.text);

    // Optional future tokens if you store them
    if (theme.bg) root.style.setProperty('--su-bg', theme.bg);
    if (theme.border) root.style.setProperty('--su-border', theme.border);

    // --- Favicon ---
    const faviconUrl = settings?.faviconUrl || '/assets/favicon.ico';
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = faviconUrl;

    // --- Apple touch icon (iOS home screen icon) ---
    const appIconUrl = settings?.appIconUrl || '/assets/app-icon.png';
    let apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href = appIconUrl;

    // --- theme-color meta (mobile browser UI color) ---
    const themeColor = theme.primary || '#000000';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = themeColor;
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setSettings,
        loading,
        listViewsVersion,
        bumpListViewsVersion,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
