// admin/src/components/Footer.jsx
import React, { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

export default function Footer() {
  const { settings } = useSettings();

  // Keep document title + icons in sync with branding settings
  useEffect(() => {
    if (!settings) return;

    if (settings.appName) {
      document.title = settings.appName;
    }

    if (settings.faviconUrl) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.faviconUrl;
    }

    if (settings.appIconUrl) {
      let apple = document.querySelector("link[rel='apple-touch-icon']");
      if (!apple) {
        apple = document.createElement('link');
        apple.rel = 'apple-touch-icon';
        document.head.appendChild(apple);
      }
      apple.href = settings.appIconUrl;
    }
  }, [settings]);

  const poweredText = settings?.poweredByText || 'serviceup / bmp';
  const poweredUrl = settings?.poweredByUrl || '';

  return (
    <footer className="su-footer">
      <span />
      <span>
        powered by…{' '}
        {poweredUrl ? (
          <a href={poweredUrl} target="_blank" rel="noreferrer">
            {poweredText}
          </a>
        ) : (
          poweredText
        )}
      </span>
    </footer>
  );
}
