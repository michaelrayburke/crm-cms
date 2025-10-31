// api/lib/fieldUtils.js
import validator from 'validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizeEmail(s) {
  const v = (s == null) ? '' : String(s).trim().toLowerCase();
  return validator.isEmail(v) ? v : '';
}

export function normalizePhoneE164(raw, def='US') {
  const p = parsePhoneNumberFromString(String(raw || ''), def);
  return p && p.isValid() ? p.number : '';
}

export function normalizeUrl(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return ''; }
  u.protocol = 'https:';
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
  return u.toString();
}

export function normalizeAddress(addr = {}, def='US') {
  return {
    line1: (addr.line1 || '').trim(),
    line2: (addr.line2 || '').trim(),
    locality: (addr.locality || '').trim(),
    admin1: { code: (addr.admin1?.code || '').trim().toUpperCase(), name: (addr.admin1?.name || '').trim() },
    postal: (addr.postal || '').trim(),
    country: { code: (addr.country?.code || def).trim().toUpperCase(), name: (addr.country?.name || '').trim() },
    geo: addr.geo || null
  };
}
