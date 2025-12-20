const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
export function isValidEmail(value) {
  if (!value) return false;
  return EMAIL_RE.test(String(value).trim());
}
export function normalizeEmail(value) {
  if (!value) return '';
  const s = String(value).trim();
  const at = s.lastIndexOf('@');
  if (at === -1) return s;
  return s.slice(0, at) + '@' + s.slice(at + 1).toLowerCase();
}

export default normalizeEmail;
