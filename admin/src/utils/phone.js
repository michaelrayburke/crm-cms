// admin/src/utils/phone.js
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizeToE164(raw, def='US') {
  const p = parsePhoneNumberFromString(String(raw || ''), def);
  return p && p.isValid() ? p.number : '';
}

export function formatPhone(value, style='international', country='US') {
  const p = parsePhoneNumberFromString(value || '', country);
  if (!p || !p.isValid()) return value || '';
  const n = p.nationalNumber;
  switch (style) {
    case 'dots':    return n.replace(/(\d{3})(\d{3})(\d{4})/, '$1.$2.$3');
    case 'hyphen':  return n.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    case 'spaced':  return n.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    case 'area':    return n.slice(0, 3);
    case 'national':return p.formatNational();
    default:        return p.formatInternational();
  }
}

export function makeTelHref(e164, ext) {
  if (!e164) return '';
  const base = `tel:${e164}`;
  return ext ? `${base};ext=${encodeURIComponent(String(ext))}` : base;
}
