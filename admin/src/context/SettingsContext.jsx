import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

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
    <SettingsContext.Provider value={{ settings, setSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
