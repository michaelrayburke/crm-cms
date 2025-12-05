import axios from "axios";

// Use environment-based base URL so we can talk directly to the Render API
// e.g. VITE_API_BASE = "https://serviceup-api.onrender.com"
// Local dev can be "http://localhost:4000" or similar.
const API_BASE = import.meta.env.VITE_API_BASE || "";

// Single Axios instance for the whole admin app
const api = axios.create({
  baseURL: API_BASE
});

// Export it both named and default so existing imports keep working
export { api };

/**
 * Fetch the list of available Gizmo Packs from the backend.
 *
 * Backend route is mounted at /api/gizmo-packs
 */
export async function getGizmoPacks() {
  const res = await api.get("/api/gizmo-packs");
  return res.data;
}

/**
 * Apply a Gizmo Pack to create a new gadget, gizmos, content types, and entries.
 *
 * Backend route is POST /api/gizmo-packs/apply
 */
export async function applyGizmoPackApi({ packSlug, gadgetSlug, gadgetName }) {
  const res = await api.post("/api/gizmo-packs/apply", {
    packSlug,
    gadgetSlug,
    gadgetName
  });
  return res.data;
}

/**
 * Persist updated application settings to the backend.
 * Called by the Settings page when admins save global settings.
 *
 * Backend route is POST /api/settings
 */
export async function saveSettings(payload) {
  const res = await api.post("/api/settings", payload);
  return res.data;
}

export default api;
