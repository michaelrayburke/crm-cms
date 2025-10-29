// admin/src/utils/address.js
export function normalizeAddress(input = {}, defaultCountry='US') {
  const out = {
    line1: (input.line1 || '').trim(),
    line2: (input.line2 || '').trim(),
    locality: (input.locality || '').trim(),
    admin1: {
      code: (input.admin1?.code || '').trim().toUpperCase(),
      name: (input.admin1?.name || '').trim(),
    },
    postal: (input.postal || '').trim(),
    country: {
      code: (input.country?.code || defaultCountry).trim().toUpperCase(),
      name: (input.country?.name || '').trim(),
    },
    geo: input.geo || null,
  };
  return out;
}

export function formatAddress(addr, style='singleLine', opts={ admin1Style:'code', countryStyle:'code' }) {
  if (!addr) return '';
  const admin1 = opts.admin1Style === 'name' ? (addr.admin1?.name || '') : (addr.admin1?.code || '');
  const country = opts.countryStyle === 'name' ? (addr.country?.name || '') : (addr.country?.code || '');
  const line = `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}`;
  const cityLine = [addr.locality, admin1].filter(Boolean).join(', ');
  const base = `${line}, ${cityLine}${addr.postal ? ' ' + addr.postal : ''}`.trim();
  switch (style) {
    case 'multiLine':  return [line, `${addr.locality}${admin1 ? ', ' + admin1 : ''} ${addr.postal || ''}`.trim(), country].filter(Boolean).join('\n');
    case 'cityState':  return cityLine;
    case 'cityOnly':   return addr.locality || '';
    case 'stateOnly':  return admin1 || '';
    case 'countryOnly':return country || '';
    case 'postalOnly': return addr.postal || '';
    default:           return [base, country].filter(Boolean).join(', ');
  }
}

export function mapsLink(addr) {
  if (addr?.geo?.lat && addr?.geo?.lng) return `https://www.google.com/maps/search/?api=1&query=${addr.geo.lat},${addr.geo.lng}`;
  const oneLine = formatAddress(addr, 'singleLine', { admin1Style: 'name', countryStyle: 'name' });
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(oneLine)}`;
}

export const mapsEmbedUrl = mapsLink;
