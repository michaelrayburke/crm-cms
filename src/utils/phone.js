@'
// admin/src/utils/phone.js

// Keep only digits
function digits(s) {
  return String(s || "").replace(/\D+/g, "");
}

/**
 * normalizeToE164("760-555-1234")           -> "+17605551234"   (US default)
 * normalizeToE164("+44 20 7946 0958")       -> "+442079460958"
 * normalizeToE164("17605551234")            -> "+17605551234"
 * normalizeToE164("0017605551234")          -> "+17605551234"
 * normalizeToE164("07555123456", { defaultCountry: "GB" }) -> "+447555123456"
 */
export function normalizeToE164(input, { defaultCountry = "US" } = {}) {
  if (input == null) return "";
  const raw = String(input).trim();

  // already E.164?
  const compact = raw.replace(/\s+/g, "");
  if (/^\+\d{8,15}$/.test(compact)) return compact;

  // common international prefix handling (00)
  let d = digits(raw.replace(/^00/, "+"));
  // If it still starts with + after stripping non-digits, recover that
  const hadPlus = /^\s*\+/.test(raw);
  if (hadPlus && d.length >= 8 && d.length <= 15) return "+" + d;

  // remove leading zeros
  d = d.replace(/^0+/, "");

  // US/CA default
  if (defaultCountry === "US" || defaultCountry === "CA") {
    if (d.length === 11 && d.startsWith("1")) return "+" + d;
    if (d.length === 10) return "+1" + d;
  }

  // If it looks like an international number length, accept
  if (d.length >= 8 && d.length <= 15) return "+" + d;

  return "";
}

export function isE164(s = "") {
  return /^\+\d{8,15}$/.test(String(s).trim());
}
'@ | Out-File -Encoding utf8 src\utils\phone.js -Force
