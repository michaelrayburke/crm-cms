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

export const api = {
  get: (url) =>
    fetch(`${API_BASE}${url}`, {
      method: 'GET',
      headers: authHeaders(),
      credentials: 'include',
    }).then(handle),
  post: (url, body) =>
    fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
      credentials: 'include',
    }).then(handle),
  patch: (url, body) =>
    fetch(`${API_BASE}${url}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
      credentials: 'include',
    }).then(handle),
  put: (url, body) =>
    fetch(`${API_BASE}${url}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
      credentials: 'include',
    }).then(handle),
  del: (url) =>
    fetch(`${API_BASE}${url}`, {
      method: 'DELETE',
      headers: authHeaders(),
      credentials: 'include',
    }).then(handle),
};

// Settings helpers
// Determine the correct path for the settings endpoint.
// If API_BASE ends with `/api` (e.g. `/api` or `https://serviceup-api.onrender.com/api`), then
// we should not prefix another `/api` when requesting settings.  Otherwise, prefix `/api`
// before `/settings` to hit the Express router mounted at `/api/settings`.
function resolveSettingsPath() {
  try {
    const base = API_BASE || '';
    // Remove trailing slash for comparison
    const baseTrimmed = base.replace(/\/+$/, '');
    // Check if the base URL ends with `/api`
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