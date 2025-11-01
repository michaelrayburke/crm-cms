// admin/src/utils/env.js
// Helper to read env and fail loudly in production if required vars are missing.
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  apiBase:     import.meta.env.VITE_API_BASE,
};

export function assertEnv({ failOnMissing = true } = {}) {
  const missing = Object.entries(env).filter(([, v]) => !v);
  if (missing.length) {
    const list = missing.map(([k]) => k).join(", ");
    console.warn("[env] Missing env vars:", list);
    if (failOnMissing && (import.meta.env.PROD || import.meta.env.MODE === "production")) {
      const el = document.getElementById("root");
      if (el) {
        el.innerHTML = `<pre style="white-space:pre-wrap;color:#b00;background:#fee;padding:16px;border-radius:8px">
⚠️ Build succeeded, but runtime env variables are missing:
${list}

Set these in the Netlify UI (Site settings → Build & deploy → Environment):
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_BASE
</pre>`;
      }
      throw new Error("Missing runtime env vars: " + list);
    }
  }
  return env;
}
