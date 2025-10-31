export function normalizeUrl(base, path = "") {
  if (!base) return path || "";
  const strip = (s) => (s || "").replace(/\/+$|^\/+/, "");
  const add   = (s) => (s || "").replace(/^\/+/, "");
  const b = strip(String(base));
  const p = add(String(path));
  return p ? `${b}/${p}` : b;
}

export function withTrailingSlash(u = "") { return u ? (u.endsWith("/") ? u : u + "/") : "/"; }
export function withLeadingSlash(u = "")  { return u ? (u.startsWith("/") ? u : "/" + u) : "/"; }
