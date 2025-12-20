export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function handle(res){
  if(!res.ok){
    const msg = await res.text().catch(()=>res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const api = {
  get: (url) => fetch(`${API_BASE}${url}`, { credentials:'include' }).then(handle),
  post: (url, body) => fetch(`${API_BASE}${url}`, {
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify(body),
    credentials:'include'
  }).then(handle),
  patch: (url, body) => fetch(`${API_BASE}${url}`, {
    method:'PATCH',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify(body),
    credentials:'include'
  }).then(handle),
  del: (url) => fetch(`${API_BASE}${url}`, { method:'DELETE', credentials:'include' }).then(handle)
};
