// site/src/api.js
export const API_BASE = import.meta.env.VITE_API_BASE || '';

async function handle(res) {
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

/**
 * Fetch a page payload for a given gadgetSlug + pageSlug.
 * Calls GET /api/public/sites/:gadgetSlug/pages/:pageSlug
 */
export async function fetchPagePayload({ gadgetSlug, pageSlug }) {
  const url = `${API_BASE}/api/public/sites/${encodeURIComponent(
    gadgetSlug,
  )}/pages/${encodeURIComponent(pageSlug)}`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });
  return handle(res);
}
