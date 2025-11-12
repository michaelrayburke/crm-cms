import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }){
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    (async ()=>{
      try{
        const data = await api.get('/settings');
        setSettings(data);
        document.documentElement.setAttribute('data-theme', data?.theme?.mode || 'light');
      }catch(e){
        setSettings({
          timezone: 'America/Los_Angeles',
          poweredBy: 'serviceup / bmp',
          theme: { mode: 'light', primary:'#000', surface:'#fff', text:'#111' },
          logoUrl:'/assets/logo.svg', faviconUrl:'/assets/favicon.ico', appIconUrl:'/assets/app-icon.png',
          hideChromeByRole: { VIEWER: false, EDITOR: false, ADMIN: false }
        });
      }finally{ setLoading(false); }
    })();
  },[]);

  return <SettingsContext.Provider value={{settings, setSettings, loading}}>{children}</SettingsContext.Provider>;
}

export const useSettings = ()=> useContext(SettingsContext);
