// src/utils/date.js
// Lightweight date formatting helpers for frontends (React/Vite, SSR-safe).

export function ordinal(n) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + "T00:00:00");
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      const [m, d, y] = value.split("/").map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(value, variant = "longOrdinal", locale = "en-US") {
  if (variant === "iso" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = toDate(value);
  if (!date) return "";
  switch (variant) {
    case "weekdayLongOrdinal": {
      const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
      const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
      const day = ordinal(date.getDate());
      const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
      return `${weekday}, ${month} ${day}, ${year}`;
    }
    case "longOrdinal": {
      const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
      const day = ordinal(date.getDate());
      const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
      return `${month} ${day}, ${year}`;
    }
    case "shortNoComma": {
      const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
      const day = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date);
      const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
      return `${month} ${day} ${year}`;
    }
    case "monthOnly": return new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
    case "yearOnly": return new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
    case "localeLong": return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" }).format(date);
    case "medium": return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
    default: return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" }).format(date);
  }
}

export function getDateParts(value, locale = "en-US") {
  const date = toDate(value);
  if (!date) return null;
  return {
    weekdayShort: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date),
    weekdayLong:  new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date),
    monthShort:   new Intl.DateTimeFormat(locale, { month: "short" }).format(date),
    monthLong:    new Intl.DateTimeFormat(locale, { month: "long" }).format(date),
    day:          date.getDate(),
    year:         date.getFullYear(),
  };
}
