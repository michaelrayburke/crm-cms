export function formatLocal(dt, opts) {
  if (!dt) return '';
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  const defaults = { dateStyle: 'medium', timeStyle: 'short' };
  return new Intl.DateTimeFormat(undefined, { ...defaults, ...opts }).format(d);
}
export function toUtcIso(dt) {
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  return new Date(d).toISOString();
}
export function formatDateOnly(dt, localeOpts) {
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', ...localeOpts }).format(d);
}
export function relativeTime(from, to = Date.now()) {
  const f = typeof from === 'string' ? new Date(from).getTime() : +from;
  const t = typeof to === 'string' ? new Date(to).getTime() : +to;
  const diff = f - t;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const MIN = 60 * 1000, H = 60 * MIN, D = 24 * H;
  if (Math.abs(diff) < MIN)   return rtf.format(Math.round(diff / 1000), 'second');
  if (Math.abs(diff) < H)     return rtf.format(Math.round(diff / MIN),   'minute');
  if (Math.abs(diff) < D)     return rtf.format(Math.round(diff / H),     'hour');
  return rtf.format(Math.round(diff / D), 'day');
}
