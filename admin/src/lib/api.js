import axios from "axios";

// Create a single Axios instance for our admin panel.
const api = axios.create({
  baseURL: "/api"
});

/**
 * Fetch the list of available Gizmo Packs from the backend.
 */
export async function getGizmoPacks() {
  const res = await api.get("/gizmo-packs");
  return res.data;
}

/**
 * Apply a Gizmo Pack to create a new gadget.
 */
export async function applyGizmoPackApi({ packSlug, gadgetSlug, gadgetName }) {
  const res = await api.post("/gizmo-packs/apply", {
    packSlug,
    gadgetSlug,
    gadgetName
  });
  return res.data;
}

// Allow named import { api }
export { api };

// Default import
export default api;
