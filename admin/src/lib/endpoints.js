/**
 * endpoints.js
 * Thin, typed-ish wrappers around apiClient for clarity & reuse.
 * Import these in your components instead of calling fetch directly.
 */
import { http } from "./apiClient";

/** Settings (in‑memory for now; DB later) */
export const settings = {
  get:   () => http.get("/settings"),
  save:  (data) => http.post("/settings", data),
};

/** Auth */
export const auth = {
  login: ({ email, password }) => http.post("/api/auth/login", { email, password }, { auth: false }),
};

/** Users */
export const users = {
  list:   (q)  => http.get(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  create: (b)  => http.post("/api/users", b),
  update: (id, b) => http.patch(`/api/users/${id}`, b),
};

/** Taxonomies */
export const taxonomies = {
  list:     () => http.get("/api/taxonomies"),
  create:   (b) => http.post("/api/taxonomies", b),
  terms:    (key) => http.get(`/api/taxonomies/${encodeURIComponent(key)}/terms`),
  addTerm:  (key, b) => http.post(`/api/taxonomies/${encodeURIComponent(key)}/terms`, b),
};

/** Content Types */
export const contentTypes = {
  list:      () => http.get("/content-types"), // alias exists server-side
  get:       (slug) => http.get(`/api/content-types/${encodeURIComponent(slug)}`),
  create:    (b) => http.post("/api/content-types", b),
  update:    (slug, b) => http.put(`/api/content-types/${encodeURIComponent(slug)}`, b),
  addField:  (slug, b) => http.post(`/api/content-types/${encodeURIComponent(slug)}/fields`, b),
  delField:  (slug, fieldId) => http.del(`/api/content-types/${encodeURIComponent(slug)}/fields/${fieldId}`),
  delType:   (slug) => http.del(`/api/content-types/${encodeURIComponent(slug)}`),
};

/** Entries */
export const entries = {
  list:   (slug) => http.get(`/content/${encodeURIComponent(slug)}`), // alias exists
  get:    (slug, id) => http.get(`/api/content/${encodeURIComponent(slug)}/${id}`),
  create: (slug, data) => http.post(`/api/content/${encodeURIComponent(slug)}`, { data }),
  update: (slug, id, data) => http.put(`/api/content/${encodeURIComponent(slug)}/${id}`, { data }),
  del:    (slug, id) => http.del(`/api/content/${encodeURIComponent(slug)}/${id}`),
};