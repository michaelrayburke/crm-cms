import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
export function parsePhone(input, defaultCountry = 'US') {
  if (!input) return null;
  return parsePhoneNumberFromString(String(input), defaultCountry) || null;
}
export function isValidPhone(input, defaultCountry = 'US') {
  const p = parsePhone(input, defaultCountry);
  return !!p && p.isValid?.();
}
export function formatE164(input, defaultCountry = 'US') {
  const p = parsePhone(input, defaultCountry);
  return p ? p.number : '';
}
export function formatNational(input, defaultCountry = 'US') {
  const p = parsePhone(input, defaultCountry);
  return p ? p.formatNational() : '';
}
export function normalizePhone(input, defaultCountry = 'US') {
  return formatE164(input, defaultCountry);
}
