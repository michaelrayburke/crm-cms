import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { api } from './lib/api';

// Create a context for global settings. In addition to the theme and other app
// settings, we expose a version counter (`listViewsVersion`) and a function
// (`bumpListViewsVersion`) that consumers can call to signal that list view
// definitions have changed. Components like ListViews.jsx and TypeList.jsx
// subscribe to this counter and will refetch when it changes.
const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  // Settings loaded from the API. This may include theme, app name, etc.
  const [settings, setSettings] = useState(null);
  // Loading flag to indicate when settings are being fetched.
  const [loading, setLoading] = useState(true);
  // Global version counter for list views. Increment this whenever a list
  // view is created, updated, or deleted to force other components to
  // refetch their list view configuration.
  const [listViewsVersion, setListViewsVersion] = useState(0);

  // Helper to increment the list views version. This should be called
  // from within ListViews.jsx after successfully saving or deleting a view.
  const bumpListViewsVersion = () => {
    setListViewsVersion((v) => v + 1);
  };

  // On mount, load the settings from the API. If the call fails, use
  // fallback values defined here so that the UI still renders.
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
          appName: 'ServiceUp Admin',
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

  // Memoize the context value to avoid unnecessary re-renders.
  const value = useMemo(
    () => ({
      settings,
      setSettings,
      loading,
      listViewsVersion,
      bumpListViewsVersion,
    }),
    [settings, loading, listViewsVersion],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
