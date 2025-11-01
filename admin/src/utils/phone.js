// admin/src/utils/phone.js

// Keep only digits
function digits(s) {
  return String(s || "").replace(/\D+/g, "");
}

/**
 * normalizeToE164("760-555-1234") -> "+17605551234"   (US default)
 * normalizeToE164("+44 20 7946 0958") -> "+442079460958"
 */
export function normalizeToE164(input, { defaultCountry = "US" } = {}) {
  if (input == null) return "";
  const raw = String(input).trim();

  // Already E.164?
  const compact = raw.replace(/\s+/g, "");
  if (/^\+\d{8,15}$/.test(compact)) return compact;

  // Handle international "00" prefix
  const hadPlus = /^\s*\+/.test(raw);
  let d = digits(raw.replace(/^00/, "+"));

  if (hadPlus && d.length >= 8 && d.length <= 15) return "+" + d;

  // Remove leading zeros
  d = d.replace(/^0+/, "");

  // US/CA default
  if (defaultCountry === "US" || defaultCountry === "CA") {
    if (d.length === 11 && d.startsWith("1")) return "+" + d;
    if (d.length === 10) return "+1" + d;
  }

  // Otherwise accept plausible international lengths
  if (d.length >= 8 && d.length <= 15) return "+" + d;

  return "";
}

export function isE164(s = "") {
  return /^\+\d{8,15}$/.test(String(s).trim());
}
