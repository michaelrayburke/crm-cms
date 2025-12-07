import axios from 'axios';

// Create a single Axios instance for our admin panel. If you already have a
// configured API client in your project, feel free to merge these helpers
// into that file. The baseURL assumes your API is served at /api relative
// to the admin UI. Adjust as needed if your deployment differs.
const api = axios.create({
  baseURL: '/api'
});

/**
 * Fetch the list of available Gizmo Packs from the backend. Each pack
 * includes metadata such as its slug, display name, description and file
 * source. Returns an array of pack objects.
 *
 * @returns {Promise<Array<{pack_slug: string, name: string, description: string, filename: string}>>}
 */
export async function getGizmoPacks() {
  const res = await api.get('/gizmo-packs');
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
  const res = await api.post('/gizmo-packs/apply', {
    packSlug,
    gadgetSlug,
    gadgetName
  });
  return res.data;
}

/**
 * Persist updated application settings to the backend. This helper mirrors
 * the original saveSettings behavior: posting the payload to /settings and
 * returning the saved data. Keeping this helper ensures existing imports
 * in Settings/index.jsx continue to work without modification.
 *
 * @param {object} payload The full settings object to persist
 * @returns {Promise<object>} The saved settings response
 */
export async function saveSettings(payload) {
  const res = await api.post('/settings', payload);
  return res.data;
}

// Export api for named-import convenience
export { api };

export default api;

