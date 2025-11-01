// admin/src/utils/env.js
export function assertEnv() {
  const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_API_BASE"];
  const missing = required.filter((k) => !import.meta.env[k]);
  if (missing.length) {
    // Log individual keys for easier diagnosis in Netlify logs
    missing.forEach((k) => console.error(`[env] Missing ${k}`));
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
