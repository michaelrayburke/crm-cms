import { API_BASE } from './config';

// Simple, standardized token store + helpers
let _token = null;
const KEY = 'serviceup.jwt';

export function getToken() {
  if (_token) return _token;
  _token = localStorage.getItem(KEY);
  return _token;
}

export function setToken(t) {
  _token = t || null;
  if (t) localStorage.setItem(KEY, t);
  else   localStorage.removeItem(KEY);
}

export async function login(email, password) {
  // token-based; no cookies needed here
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || `Login failed (${res.status})`);
  }
  const json = await res.json(); // { token, user }
  setToken(json.token);
  return json;
}

export function logout() {
  setToken(null);
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
