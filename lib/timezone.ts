/**
 * Single source of truth for "what timezone is this society in".
 *
 * The root bug behind a long list of QA findings: every date/time in the app
 * was being parsed and formatted with whatever the ambient runtime happened
 * to default to — UTC on the server (Vercel), the visitor's own device
 * clock in the browser. Same stored instant, two different displayed times,
 * five hours apart for Asia/Karachi. Forms would silently store a value five
 * hours later than what the resident actually typed.
 *
 * The fix is to stop relying on the runtime's ambient zone anywhere and
 * always convert explicitly against this one IANA identifier — on the way a
 * "datetime-local" form field is parsed into a UTC instant, and on the way
 * a stored instant is formatted back out for display. Because it's a literal
 * constant (not something read from the database at request time), it
 * behaves identically whether the code executing it is a Server Component
 * running in Node or a Client Component running in the visitor's browser —
 * which is exactly the property that was missing before.
 *
 * Green Meadows Residency has one physical gate, so a single fixed zone is
 * enough for this deployment; a genuine multi-society build would carry this
 * per-society instead.
 */
export const DEFAULT_TIME_ZONE = 'Asia/Karachi';

/** True when a date-time string already carries its own UTC/offset marker. */
function hasExplicitOffset(value: string): boolean {
  return /Z$|[+-]\d{2}:?\d{2}$/.test(value.trim());
}

/** How far `timeZone`'s local wall clock is ahead of UTC at `date`, in ms. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  // Some environments render midnight as "24" for hour12: false.
  const hour = get('hour') === '24' ? 0 : Number(get('hour'));
  const asIfUtc = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    hour,
    Number(get('minute')),
    Number(get('second')),
  );
  return asIfUtc - date.getTime();
}

/**
 * Turns a bare "YYYY-MM-DDTHH:mm" (the value a `<input type="datetime-local">`
 * submits) into the UTC instant it represents when read as a wall-clock time
 * in `timeZone`. Strings that already carry an explicit UTC/offset marker,
 * and anything that isn't a plain date-time string, pass straight through to
 * `new Date()` unchanged.
 */
export function zonedTimeToUtc(value: string, timeZone: string = DEFAULT_TIME_ZONE): Date {
  const trimmed = value.trim();
  if (hasExplicitOffset(trimmed) || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed)) {
    return new Date(trimmed);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
  if (!match) return new Date(trimmed);
  const [, year, month, day, hour, minute, second] = match;

  // First guess: treat the wall-clock fields as if they were UTC, then work
  // out how far `timeZone` actually sits from UTC at that moment and correct
  // for it. One pass is enough — DST transitions are a same-day, low-single-
  // -digit-minutes edge case this app never needs to be exact about.
  const naiveUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    second ? Number(second) : 0,
  );
  const offset = timeZoneOffsetMs(new Date(naiveUtc), timeZone);
  return new Date(naiveUtc - offset);
}

/**
 * The hour and minute `date` falls on when read as a wall clock in
 * `timeZone`. Use this instead of `Date#getHours()`/`getMinutes()` for
 * anything business-meaning (greeting text, "is this within opening hours",
 * amenity slot labels) — the plain getters return the *runtime's* local
 * time, which is UTC on the server and whatever the device is set to in the
 * browser, neither of which is the society's actual clock.
 */
export function zonedHourMinute(date: Date, timeZone: string = DEFAULT_TIME_ZONE): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return { hour: Number(get('hour')) % 24, minute: Number(get('minute')) };
}

/** Minutes since local midnight, in `timeZone`. */
export function zonedMinutesFromMidnight(date: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  const { hour, minute } = zonedHourMinute(date, timeZone);
  return hour * 60 + minute;
}

/**
 * The UTC instant of local midnight for `date`'s calendar day in `timeZone`.
 * Use this instead of `new Date(d.getFullYear(), d.getMonth(), d.getDate())`
 * for "start of today" / "N days ago" bucketing — the plain constructor reads
 * calendar fields off the runtime's local time, which near the society's own
 * midnight can land on the wrong day entirely (Asia/Karachi is UTC+5, so its
 * 00:00–04:59 is still "yesterday" server-side on a UTC host).
 */
export function startOfZonedDay(date: Date, timeZone: string = DEFAULT_TIME_ZONE): Date {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return zonedTimeToUtc(`${key}T00:00`, timeZone);
}
