// src/utils/date.ts
// Lightweight date formatting helpers for frontends (React/Vite, SSR-safe).
// Stores remain ISO (YYYY-MM-DD) in the DB; these are for display only.

export type DateVariant =
  | "weekdayLongOrdinal"  // Friday, October 3rd, 2025
  | "longOrdinal"         // October 3rd, 2025
  | "shortNoComma"        // Oct 3 2025
  | "monthOnly"           // October
  | "yearOnly"            // 2025
  | "localeLong"          // October 3, 2025 (locale aware, no ordinal)
  | "medium"              // Oct 3, 2025 (locale aware)
  | "iso";                // 2025-10-03 (as-is, if ISO)

/** Ordinal suffix: 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 4 -> 4th, ... */
export function ordinal(n: number): string {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Normalize various input strings into a Date. Accepts ISO YYYY-MM-DD or other parseables. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime()); // defensive copy
  if (typeof value === "string") {
    // ISO from <input type="date">
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + "T00:00:00");
    // MM/DD/YYYY fallback (if any legacy values exist)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      const [m, d, y] = value.split("/").map(Number);
      return new Date(y, m - 1, d);
    }
    // Last resort
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Format a date string into a human display, with several common variants. */
export function formatDate(
  value: unknown,
  variant: DateVariant = "longOrdinal",
  locale = "en-US"
): string {
  if (variant === "iso" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value; // already ISO
  }

  const date = toDate(value);
  if (!date) return "";

  switch (variant) {
    case "weekdayLongOrdinal": {
      const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
      const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
      const day = ordinal(date.getDate());
      const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
      return `${weekday}, ${month} ${day}, ${year}`; // Friday, October 3rd, 2025
    }
    case "longOrdinal": {
      const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
      const day = ordinal(date.getDate());
      const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
      return `${month} ${day}, ${year}`; // October 3rd, 2025
    }
    case "shortNoComma": {
      const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
      const day = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date);
      const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
      return `${month} ${day} ${year}`; // Oct 3 2025
    }
    case "monthOnly": {
      return new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
    }
    case "yearOnly": {
      return new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
    }
    case "localeLong": {
      return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" }).format(date);
    }
    case "medium": {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
    }
    default: {
      return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" }).format(date);
    }
  }
}

/** Return broken-out parts if you need custom layouts (e.g., "Oct", 3, 2025, Fri). */
export function getDateParts(value: unknown, locale = "en-US"): {
  weekdayShort: string; weekdayLong: string; monthShort: string; monthLong: string; day: number; year: number;
} | null {
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
