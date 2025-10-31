// admin/src/utils/email.js
export function makeMailtoHref({ to, cc, bcc, subject, body } = {}) {
  const list = v => !v ? [] : (Array.isArray(v) ? v : [v]);
  const toList = list(to).filter(Boolean);
  const ccList = list(cc).filter(Boolean);
  const bccList = list(bcc).filter(Boolean);
  const params = [];
  if (ccList.length)  params.push(`cc=${encodeURIComponent(ccList.join(','))}`);
  if (bccList.length) params.push(`bcc=${encodeURIComponent(bccList.join(','))}`);
  if (subject)        params.push(`subject=${encodeURIComponent(subject)}`);
  if (body)           params.push(`body=${encodeURIComponent(body)}`);
  const base = `mailto:${encodeURIComponent(toList.join(','))}`;
  return params.length ? `${base}?${params.join('&')}` : base;
}

export function normalizeEmail(s) {
  return (s == null) ? '' : String(s).trim().toLowerCase();
}
