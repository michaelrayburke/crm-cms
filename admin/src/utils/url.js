export function isValidUrl(value) {
  try { new URL(String(value)); return true; } catch { return false; }
}
export function ensureProtocol(value, protocol = 'https:') {
  if (!value) return '';
  try { return new URL(value).toString(); }
  catch {
    const v = String(value).trim();
    if (!v) return '';
    return `${protocol}//${v.replace(/^\/\//, '')}`;
  }
}
export function withLeadingSlash(u = '') {
  if (!u) return '/';
  return u.startsWith('/') ? u : '/' + u;
}
export function withTrailingSlash(u = '') {
  if (!u) return '/';
  return u.endsWith('/') ? u : u + '/';
}
export function normalizeUrl(base, path = '') {
  if (!base) return path || '';
  const strip = (s) => (s || '').replace(/\/+$/g, '');
  const add   = (s) => (s || '').replace(/^\/+/, '');
  const b = strip(String(base));
  const p = add(String(path));
  return p ? `${b}/${p}` : b;
}

export default normalizeUrl;
