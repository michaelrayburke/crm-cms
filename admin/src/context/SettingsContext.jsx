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
          app_name: 'ServiceUp', // keep naming consistent with your title logic
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

  // 2) Update document title whenever settings changes
  useEffect(() => {
    const title = settings?.app_name || settings?.name || 'ServiceUp';
    document.title = title;
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

