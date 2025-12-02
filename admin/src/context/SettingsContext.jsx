import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

// SettingsContext holds global settings, a loading flag, and a version counter
// used to notify list pages when list view definitions change. The
// bumpListViewsVersion function increments the version so that any
// component that depends on list views (like TypeList.jsx) can refetch
// its configuration when a list view is saved or deleted.
const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  // NEW: global version counter for list views. See ListViews.jsx
  // and TypeList.jsx for usage.
  const [listViewsVersion, setListViewsVersion] = useState(0);

  // Call this function to signal that list views have changed (e.g. after
  // save or delete). Components that listen for listViewsVersion will
  // automatically update.
  const bumpListViewsVersion = () => {
    setListViewsVersion((v) => v + 1);
  };

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
