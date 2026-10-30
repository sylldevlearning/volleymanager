/** Dates, times and numbers in the format of the app language (Intl), screens and PDF alike. */

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // 'YYYY-MM-DD' is a day, not midnight UTC
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
}

const DATE_STYLES = {
  /** 16/05/2026, 5/16/2026, 16.05.2026… */
  short: { day: 'numeric', month: 'numeric', year: 'numeric' },
  /** samedi 16 mai 2026 */
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  /** 16/05 — chart labels */
  dayMonth: { day: '2-digit', month: '2-digit' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatDate(value: Date | string, lang: string, style: keyof typeof DATE_STYLES = 'short'): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  return new Intl.DateTimeFormat(lang, DATE_STYLES[style]).format(date);
}

/** A stored 'HH:MM' in the language's clock: 09:00, 9:00 AM… */
export function formatClock(hhmm: string, lang: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const date = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
  // 24-hour clocks keep the leading zero (09:00), 12-hour ones do not (9:00 AM)
  const hour = uses12HourClock(lang) ? 'numeric' : '2-digit';
  return new Intl.DateTimeFormat(lang, { hour, minute: '2-digit' }).format(date);
}

export function formatNumber(value: number, lang: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(lang, options).format(value);
}

/** 0-100 → "45 %", "45%"… */
export function formatPercent(value: number, lang: string): string {
  return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
}

/** Whether the language reads the time on a 12-hour clock (English) — for the time pickers. */
export function uses12HourClock(lang: string): boolean {
  return !new Intl.DateTimeFormat(lang, { hour: 'numeric' }).format(new Date(2000, 0, 1, 13)).includes('13');
}
