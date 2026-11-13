// All API date-times are salon-local strings without offset.
// Never use toISOString() here: it converts to UTC and shifts the day/hour.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Builds YYYY-MM-DD from the LOCAL year/month/day parts. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

/** Parses YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') would be UTC). */
export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Converts an API string (date or local date-time) or a Date into a Date for display. */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  if (DATE_ONLY.test(value)) {
    return parseDateString(value);
  }
  // Keep at most 3 fractional digits (the API can send 6).
  return new Date(value.replace(/(\.\d{3})\d+$/, '$1'));
}

/** Monday of the week that contains the given date (00:00 local). */
export function startOfWeek(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Example: "seg., 16 de nov. de 2026". */
export function formatDate(value: string | Date): string {
  return dateFormat.format(toDate(value));
}

/** 24h time, example: "09:00". */
export function formatTime(value: string | Date): string {
  return timeFormat.format(toDate(value));
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} às ${formatTime(value)}`;
}

/** "09:00:00" -> "09:00" (for <input type="time">). */
export function trimSeconds(time: string): string {
  return time.slice(0, 5);
}