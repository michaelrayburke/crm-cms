export function formatAddressOneLine(a = {}) {
  const parts = [
    a.line1,
    a.line2,
    [a.city, a.state].filter(Boolean).join(', '),
    a.postalCode,
    a.country
  ].filter(Boolean);
  return parts.join(' • ');
}
export function formatAddressMultiLine(a = {}) {
  const lineA = [a.line1, a.line2].filter(Boolean).join(' ');
  const lineB = [[a.city, a.state].filter(Boolean).join(', '), a.postalCode].filter(Boolean).join(' ');
  const lineC = a.country || '';
  return [lineA, lineB, lineC].filter(Boolean).join('\n');
}
export function normalizeAddress(a = {}) {
  const norm = (v) => (typeof v === 'string' ? v.trim() : v);
  return {
    line1: norm(a.line1) || '',
    line2: norm(a.line2) || '',
    city: norm(a.city) || '',
    state: (norm(a.state) || '').toUpperCase(),
    postalCode: norm(a.postalCode) || '',
    country: norm(a.country) || ''
  };
}

export default normalizeAddress;
