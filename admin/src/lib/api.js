import axios from "axios";

// Create a single Axios instance for our admin panel. If you already have a
// configured API client in your project, feel free to merge these helpers
// into that file. The baseURL assumes your API is served at /api relative
// to the admin UI. Adjust as needed if your deployment differs.
const api = axios.create({
  baseURL: "/api"
});

/**
 * Fetch the list of available Gizmo Packs from the backend. Each pack
 * includes metadata such as its slug, display name, description and file
 * source. Returns an array of pack objects.
 *
 * @returns {Promise<Array<{pack_slug: string, name: string, description: string, filename: string}>>}
 */
export async function getGizmoPacks() {
  const res = await api.get("/gizmo-packs");
  return res.data;
}

/**
 * Apply a Gizmo Pack to create a new gadget. The backend will create
 * the gadget, gizmos, content types and entries defined in the pack. The
 * gadgetSlug will be used to prefix newly created gizmo slugs, while
 * gadgetName will be the human-friendly name of the gadget.
 *
 * @param {object} opts
 * @param {string} opts.packSlug The slug of the pack to apply
 * @param {string} opts.gadgetSlug A unique slug for the new gadget
 * @param {string} opts.gadgetName The display name for the gadget
 * @returns {Promise<{gadget_id: string, gadget_slug: string, gadget_name: string}>}
 */
export async function applyGizmoPackApi({ packSlug, gadgetSlug, gadgetName }) {
  const res = await api.post("/gizmo-packs/apply", {
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
 * This will POST to /api/settings (because baseURL = "/api" above).
 */
export async function saveSettings(payload) {
  const res = await api.post("/settings", payload);
  return res.data;
}

// Named export so `import { api } from '../lib/api'` works
export { api };

// Default export so `import api from '../lib/api'` also works
export default api;
