// admin/src/utils/url.js
export function normalizeUrl(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return ''; }
  u.protocol = 'https:';
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
  return u.toString();
}

export function displayUrl(raw, variant='noProtocol') {
  const href = normalizeUrl(raw);
  if (!href) return '';
  const u = new URL(href);
  const host = u.hostname;
  const path = u.pathname.replace(/\/$/, '');
  switch (variant) {
    case 'full':           return href;
    case 'domain':         return host;
    case 'domainAndPath':  return host + (path ? path : '');
    case 'noProtocol':
    default:               return href.replace(/^https?:\/\//i, '');
  }
}

export function makeUrlHref(raw) {
  const normalized = normalizeUrl(raw);
  return normalized || '';
}

export function externalLinkAttrs({ newTab = true } = {}) {
  return newTab ? { target: '_blank', rel: 'noopener noreferrer' } : { rel: 'noopener' };
}

export function faviconUrl(raw) {
  const href = normalizeUrl(raw);
  if (!href) return '';
  const u = new URL(href);
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(u.hostname)}`;
}
