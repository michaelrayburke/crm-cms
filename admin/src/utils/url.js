// admin/src/utils/url.js
export function normalizeUrl(base, path = "") {
  if (!base) return path || "";
  const strip = (s) => (s || "").replace(/\/+$/g, "");
  const add = (s) => (s || "").replace(/^\/+/, "");
  const b = strip(String(base));
  const p = add(String(path));
  return p ? `${b}/${p}` : b;
}
export function withTrailingSlash(u = "") {
  if (!u) return "/";
  return u.endsWith("/") ? u : u + "/";
}
export function withLeadingSlash(u = "") {
  if (!u) return "/";
  return u.startsWith("/") ? u : "/" + u;
}
