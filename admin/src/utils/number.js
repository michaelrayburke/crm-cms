
export function formatNumber(value, locale='en-US', options={}) {
  return new Intl.NumberFormat(locale, options).format(value)
}
