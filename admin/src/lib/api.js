// admin/src/lib/api.js

export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function handle(res) {
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// Attach Authorization: Bearer <token> when available
function authHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const token = localStorage.getItem('serviceup.jwt');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }
  return headers;
}

// Normalize the settings URL to ensure the correct `/api/settings` path is used.
// If the client code calls '/settings', we should prefix '/api' when API_BASE
// does not already end with '/api'. This is necessary because the Express server
// mounts the settings router at `/api/settings`, and without the prefix the
// request will 404 on production deployments (where API_BASE is the bare domain).
function normalizeSettingsUrl(url) {
  try {
    // Only rewrite when the request is exactly '/settings' or '/settings/'.
    const isSettings =
      url === '/settings' || url === 'settings' || url === '/settings/';
    if (!isSettings) {
      return url;
    }
    const base = API_BASE || '';
    // Remove any trailing slashes from the base URL for comparison
    const baseTrimmed = base.replace(/\/+$/, '');
    const endsWithApi = baseTrimmed.endsWith('/api');
    // If API_BASE already ends with '/api', we don't prefix again; otherwise, add '/api'
    return endsWithApi ? '/settings' : '/api/settings';
  } catch {
    // Fallback to safe default
    return '/api/settings';
  }
}

export const api = {
  get: (url) => {
    const finalUrl = normalizeSettingsUrl(url);
    return fetch(`${API_BASE}${finalUrl}`, {
      method: 'GET',
      headers: authHeaders(),
      credentials: 'include',
    }).then(handle);
  },
  post: (url, body) => {
    const finalUrl = normalizeSettingsUrl(url);
    return fetch(`${API_BASE}${finalUrl}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
      credentials: 'include',
    }).then(handle);
  },
  patch: (url, body) => {
    const finalUrl = normalizeSettingsUrl(url);
    return fetch(`${API_BASE}${finalUrl}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
      credentials: 'include',
    }).then(handle);
  },
  put: (url, body) => {
    const finalUrl = normalizeSettingsUrl(url);
    return fetch(`${API_BASE}${finalUrl}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
      credentials: 'include',
    }).then(handle);
  },
  del: (url) => {
    const finalUrl = normalizeSettingsUrl(url);
    return fetch(`${API_BASE}${finalUrl}`, {
      method: 'DELETE',
      headers: authHeaders(),
      credentials: 'include',
    }).then(handle);
  },
};

/* ------------------------------------------------------------------ */
/* Settings helpers                                                   */
/* ------------------------------------------------------------------ */

// Determine the correct path for the settings endpoint.
// If API_BASE ends with `/api` (e.g. `/api` or `https://.../api`), then
// we should not prefix another `/api` when requesting settings. Otherwise,
// prefix `/api` before `/settings` to hit the Express router mounted at
// `/api/settings`.
function resolveSettingsPath() {
  try {
    const base = API_BASE || '';
    // Remove trailing slash for comparison
    const baseTrimmed = base.replace(/\/+$/, '');
    const endsWithApi = baseTrimmed.endsWith('/api');
    return endsWithApi ? '/settings' : '/api/settings';
  } catch {
    // Fallback to the safe default
    return '/api/settings';
  }
}

export async function fetchSettings() {
  // Loads the global settings via GET at the correct path
  const path = resolveSettingsPath();
  return api.get(path);
}

export async function saveSettings(settings) {
  // Persists the provided settings via PUT at the correct path
  const path = resolveSettingsPath();
  return api.put(path, settings);
}

/* ------------------------------------------------------------------ */
/* Gizmo Packs helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch the list of available Gizmo Packs from the backend.
 * Returns an array of pack objects:
 * [{ pack_slug, name, description, filename }, ...]
 */
export async function getGizmoPacks() {
  // Backend router is mounted as: app.use('/api/gizmo-packs', gizmoPacksRouter)
  // So the full path is: GET /api/gizmo-packs
  return api.get('/api/gizmo-packs');
}

/**
 * Apply a Gizmo Pack to create a new gadget.
 * The backend will create the gadget, gizmos, content types and entries
 * defined in the pack.
 *
 * @param {object} opts
 * @param {string} opts.packSlug   The slug of the pack to apply
 * @param {string} opts.gadgetSlug A unique slug for the new gadget
 * @param {string} opts.gadgetName The display name for the gadget
 * @returns {Promise<any>} Whatever the backend returns after applying the pack
 */
export async function applyGizmoPackApi({ packSlug, gadgetSlug, gadgetName }) {
  // POST /api/gizmo-packs/apply
  return api.post('/api/gizmo-packs/apply', {
    packSlug,
    gadgetSlug,
    gadgetName,
  });
}
