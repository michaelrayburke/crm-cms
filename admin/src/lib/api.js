import axios from "axios";

// Create a single Axios instance for our admin panel. If you already have a
// configured API client in your project, feel free to merge these helpers
// into that file. The baseURL assumes your API is served at /api relative
// to the admin UI. Adjust as needed if your deployment differs.
const api = axios.create({
  baseURL: "/api"
});

// Export the axios instance both as a named export (`api`) and as the default export.
// This allows other modules to import { api } from '../lib/api' as well as import api from '../lib/api'.
export { api };

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
 *
 * The SettingsPage imports `saveSettings` from this module and calls it when
 * administrators click the “Save settings” button.  The backend is expected
 * to expose a POST /settings endpoint (relative to the baseURL of this
 * API client) which accepts a settings payload and returns either the
 * updated settings or nothing.  By centralizing the call here, other parts
 * of the admin panel can reuse the same helper without duplicating
 * request logic.
 *
 * @param {object} payload A settings object representing the current form state.
 * @returns {Promise<any>} The response data from the server.
 */
export async function saveSettings(payload) {
  const res = await api.post("/settings", payload);
  return res.data;
}

export default api;
