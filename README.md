# CRM CMS – Admin + API (Netlify-ready)

This bundle includes **only** the config files needed to make your GitHub repo deploy cleanly on Netlify, *without* any local machine steps.

## Included

- `netlify.toml` (root): tells Netlify to build from `/admin`, install with `--no-optional` to avoid Rollup's native-binary quirk, and publish `dist/`.
- `admin/vite.config.js`: enables React plugin + path aliases.
- `admin/package.json`: pins **rollup** and Node engines.

## Apply

1. Download & unzip at the repo root.
2. Commit & push:
   ```bash
   git add netlify.toml admin/vite.config.js admin/package.json
   git commit -m "chore: Netlify build config, pin rollup, add Vite React plugin"
   git push origin main
   ```
3. Redeploy on Netlify.

## Notes

- With `[build].base = "admin"`, `publish` must be `"dist"` (not `admin/dist`).
- Set env vars in Netlify UI: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE`.
