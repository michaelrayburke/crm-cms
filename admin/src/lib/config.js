// Ensures we always call the /api base, even if env misses the suffix
const raw = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
export const API_BASE = raw.endsWith('/api') ? raw : `${raw.replace(/\/+$/, '')}/api`;

export default { API_BASE };