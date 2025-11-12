import React from 'react';
import { useSettings } from '../context/SettingsContext';

export default function Footer(){
  const { settings } = useSettings();
  return (
    <footer className="su-footer">
      <span />
      <span>powered by… {settings?.poweredBy || 'serviceup / bmp'}</span>
    </footer>
  );
}
