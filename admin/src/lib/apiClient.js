import { API_BASE } from './config';
import { getToken } from './auth';

// Centralized fetch wrapper: adds base URL, Authorization, JSON handling, and errors.
// Default credentials: 'omit' since we're using JWT header auth (not cookies).
async function request(path, {
  method = 'GET',
  headers = {},
  body,
  json = true,
  credentials = 'omit'
} = {}) {
  const token = getToken();
  const url = path.startsWith('http')
    ? path
    : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  const finalHeaders = {
    ...(json && body ? { 'Content-Type': 'application/json' } : {}),
    ...headers
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    credentials,
    body: body && json ? JSON.stringify(body) : body
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p, opts)        => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  put: (p, body, opts)  => request(p, { ...opts, method: 'PUT', body }),
  patch: (p, body, opts)=> request(p, { ...opts, method: 'PATCH', body }),
  del: (p, opts)        => request(p, { ...opts, method: 'DELETE' }),
};

export default api;