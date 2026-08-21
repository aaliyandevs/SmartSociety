import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { DEFAULT_TIME_ZONE, zonedHourMinute } from '@/lib/timezone';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PKR = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 2,
});

const PKR_COMPACT = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

type Numeric = number | string | { toString(): string } | null | undefined;

/** Prisma returns Decimal objects; normalise everything to a JS number. */
export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value: Numeric): string {
  return PKR.format(toNumber(value));
}

export function formatCompactCurrency(value: Numeric): string {
  return PKR_COMPACT.format(toNumber(value));
}

export function formatNumber(value: Numeric): string {
  return new Intl.NumberFormat('en-PK').format(toNumber(value));
}

/**
 * `timeZone` is always passed explicitly (never left to the runtime default)
 * so that a Server Component executing on the server and a Client Component
 * executing in the visitor's browser render the exact same stored instant
 * identically — see `lib/timezone.ts` for why that used to differ by 5 hours.
 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}

/**
 * Escape hatch for one-off `Intl.DateTimeFormat` calls (weekday labels,
 * month/year headers, …) that still need the society's timezone forced in
 * rather than defaulting to the runtime's. Prefer `formatDate`/`formatDateTime`/
 * `formatTime` above when they already cover the shape you need.
 */
export function formatInTimeZone(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-PK',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: DEFAULT_TIME_ZONE }).format(date);
}

/**
 * The stored `GatePassStatus` only ever tracks whether a pass has been used,
 * expired, cancelled or refused — it has no notion of "not started yet", so
 * a pass booked for tomorrow shows as bare "Active" everywhere today. This
 * derives the status actually worth showing a human, without touching the
 * stored enum (verification logic in `services/gate-service.ts` still checks
 * `validFrom`/`validUntil` directly and is unaffected).
 */
export function getPassDisplayStatus(pass: {
  status: string;
  validFrom: Date | string;
}): string {
  if (pass.status !== 'ACTIVE') return pass.status;
  const validFrom = typeof pass.validFrom === 'string' ? new Date(pass.validFrom) : pass.validFrom;
  return validFrom > new Date() ? 'SCHEDULED' : 'ACTIVE';
}

/** "morning" / "afternoon" / "evening", based on the society's local clock. */
export function timeOfDayGreeting(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const { hour } = zonedHourMinute(date);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** "2 hours ago" / "in 3 days" — used across timelines and SLA badges. */
export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return 'just now';
}

/** Minutes-from-midnight (used by amenity opening hours) → "06:00 AM". */
export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Turns SCREAMING_SNAKE enum values into "Screaming Snake" for display. */
/**
 * Enum values that don't read correctly through a naive per-word title-case
 * (an acronym gets flattened to "Upi", a unit size reads as "Two Bhk" instead
 * of "2 BHK"). Keyed by the raw SCREAMING_SNAKE value so it works regardless
 * of which enum it came from.
 */
const HUMANISE_OVERRIDES: Record<string, string> = {
  // "UPI" is India's instant-payment rail; Raast is Pakistan's equivalent —
  // the enum value stays UPI in the database (renaming it is a migration,
  // not a display fix), but nothing user-facing should say "UPI".
  UPI: 'Raast',
  NETBANKING: 'Net banking',
  QR_SCAN: 'QR scan',
  GATE_CODE: 'Gate code',
  ONE_BHK: '1 BHK',
  TWO_BHK: '2 BHK',
  THREE_BHK: '3 BHK',
  FOUR_BHK: '4 BHK',
};

export function humanise(value: string | null | undefined): string {
  if (!value) return '—';
  if (value in HUMANISE_OVERRIDES) return HUMANISE_OVERRIDES[value];
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** "1 read" / "6 reads" — used instead of the lazy "6 read(s)" everywhere. */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function truncate(value: string, max = 80): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * YYYY-MM-DD in the society's timezone (not the UTC shift you get from
 * `toISOString()`, and not whatever zone the host machine happens to be in —
 * see `lib/timezone.ts`). Feeds `<input type="date">` default values.
 */
export function toDateInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Same, for `<input type="datetime-local">` default values. */
export function toDateTimeInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
