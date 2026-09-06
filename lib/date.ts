// lib/daily-search.ts already defines and exports this; re-export it here so
// lib/date.ts has a single source of truth rather than a second constant.
export { DEFAULT_TIME_ZONE, dayKeyInTimeZone } from "./daily-search";
import { DEFAULT_TIME_ZONE, dayKeyInTimeZone } from "./daily-search";

export function serializeDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

// Converts a calendar date (YYYY-MM-DD, as produced by <input type="date">) to
// the ISO instant for midnight local time in timeZone on that day. Built by
// asking Intl what a UTC-midnight guess reads as locally, then correcting by
// the difference, rather than hand-rolling an offset table (handles DST too).
export function calendarDateToIso(value: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid calendar date");

  const [year, month, day] = value.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcGuess));
  const value2 = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  // Midnight can format as "24" in some locales/hour12 combinations; normalize.
  const hour = value2.hour === "24" ? 0 : Number(value2.hour);
  const localAsUtc = Date.UTC(
    Number(value2.year),
    Number(value2.month) - 1,
    Number(value2.day),
    hour,
    Number(value2.minute),
    Number(value2.second)
  );
  const offsetMs = localAsUtc - utcGuess;
  return new Date(utcGuess - offsetMs).toISOString();
}

// Formats a stored calendar-day instant (e.g. from calendarDateToIso) so it
// renders as that same day for every viewer, regardless of the machine's
// local time zone. Caller picks the parts (month/day, or month/day/year);
// timeZone is always pinned, never left to the runtime default.
export function formatCalendarDate(
  iso: string,
  parts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  return new Date(iso).toLocaleDateString("en-US", { ...parts, timeZone });
}

export function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid date");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export function daysBetween(startIso: string | null, end = new Date()): number | null {
  if (!startIso) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

export function isDueOrOverdue(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= now.getTime();
}

// The inverse of calendarDateToIso: takes a stored instant back to the YYYY-MM-DD
// an <input type="date"> expects, read in timeZone. Slicing toISOString() instead
// reads the instant in UTC, which lands a day early whenever timeZone is ahead of
// UTC, so an edit form would re-open showing the day before the stored one.
export function isoToCalendarDate(iso: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  return dayKeyInTimeZone(new Date(iso), timeZone);
}
