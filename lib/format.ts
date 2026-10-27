import moment from 'moment'
import type { components } from '@/lib/generated/schema'

/** A zone a user can choose: their times are drawn in it and their days counted in it. */
export type TimeZoneName = components['schemas']['UpdateMeRequest']['timezone']

/** The company default, US Eastern: where an account starts, and what draws before sign-in. */
export const BUSINESS_TIMEZONE: TimeZoneName = 'America/New_York'

/** The zones Settings offers, in the order it lists them. */
export const TIME_ZONES: { value: TimeZoneName; label: string; city: string }[] = [
  { value: 'America/New_York', label: 'Eastern Time (US)', city: 'New York' },
  { value: 'Asia/Karachi', label: 'Pakistan Time', city: 'Karachi' },
]

// The signed-in user's zone. CurrentUserProvider sets it and redraws the app when
// it changes, so every helper below draws in it without screens passing it in.
let displayZone: string = BUSINESS_TIMEZONE

export function setDisplayTimeZone(zone: string) {
  displayZone = zone
}

export function displayTimeZone(): string {
  return displayZone
}

/**
 * What a zone is called at an instant: "EDT" or "EST" for Eastern, "PKT" for Pakistan.
 *
 * Intl calls Karachi "GMT+5" in English, which nobody here would recognise.
 */
export function zoneAbbreviation(zone: string, at: Date = new Date()) {
  if (zone === 'Asia/Karachi') return 'PKT'
  const named = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')
  return named ? named.value : zone
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return phone
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Date + time in the user's zone, 12-hour: "Sep 23, 2026, 2:14 PM". */
export function formatDateTime(iso: string) {
  return formatDateTimeIn(iso, displayZone)
}

/**
 * Short name of the user's zone right now: "EDT", "EST" or "PKT".
 *
 * For a table of timestamps, where naming the zone once beside the title says
 * the same thing as repeating it in every cell and leaves room for the data.
 * Kept as `localZoneName` for call-site stability; it is the user's chosen
 * zone, not the laptop's.
 */
export function localZoneName(at: Date = new Date()) {
  return zoneAbbreviation(displayZone, at)
}

/**
 * A full instant in the user's zone, named: "Sep 23, 2026, 2:14 PM EDT".
 *
 * For timestamps the API sends without a zone beside them. The abbreviation
 * is part of the string so the time is never read as the laptop's local day.
 */
export function formatInstant(iso: string) {
  return `${formatDateTimeIn(iso, displayZone)} ${zoneAbbreviation(displayZone, new Date(iso))}`
}

/**
 * An instant drawn in a named zone, the zone left to a caption.
 *
 * Always 12-hour so a locale that prefers 24-hour does not change how rows
 * read. Funnel drill-down passes the reply's zone; elsewhere use
 * `formatDateTime` (the user's zone).
 */
export function formatDateTimeIn(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })
}

/** A time of day, named so it reads the same anywhere: "2:14 PM EDT". The user's zone by default. */
export function formatTime(iso: string, timeZone: string = displayZone) {
  const time = new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })
  return `${time} ${zoneAbbreviation(timeZone, new Date(iso))}`
}

/** Calendar day of an instant in the user's zone: "Sep 15, 2026". */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: displayZone,
  })
}

/**
 * A calendar day — "Sep 15, 2026" — from a plain `YYYY-MM-DD`.
 *
 * Read in UTC, because a date-only string has no time and no zone: taken as an
 * instant it is UTC midnight, which reads as the day before anywhere west of
 * Greenwich.
 */
function asUtcDay(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, 12))
}

export function formatDay(day: string) {
  return asUtcDay(day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Sep 17, 2026" for one day, "Sep 15 – Sep 21, 2026" for more, the year said once. */
export function formatDayRange(start: string, end: string) {
  if (start === end) return formatDay(start)
  const opensAnotherYear = start.slice(0, 4) !== end.slice(0, 4)
  const from = opensAnotherYear
    ? formatDay(start)
    : asUtcDay(start).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
  return `${from} – ${formatDay(end)}`
}

/** What a zone is called on a given day, "EDT" or "PKT", since that's how times read here. */
export function formatZone(day: string, timeZone: string) {
  return zoneAbbreviation(timeZone, asUtcDay(day))
}

/** A 0 to 1 ratio as "12.5%", or "n/a" when there was nothing to divide by. */
export function formatPercent(rate: number | null) {
  return rate === null ? 'n/a' : `${(rate * 100).toFixed(1)}%`
}

function elapsedParts(sinceIso: string, nowMs: number) {
  const duration = moment.duration(Math.max(0, nowMs - moment(sinceIso).valueOf()))
  return {
    minutes: Math.floor(duration.asMinutes()),
    seconds: duration.seconds(),
  }
}

export function formatElapsed(startedAtIso: string, nowMs: number = Date.now()) {
  const { minutes, seconds } = elapsedParts(startedAtIso, nowMs)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Zero-padded `mm:ss`, matching the Queue table's "03:12" column. */
export function formatWaitTime(sinceIso: string, nowMs: number = Date.now()) {
  const { minutes, seconds } = elapsedParts(sinceIso, nowMs)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/** Spoken form, so screen readers don't read "03:12" as digits. */
export function formatWaitTimeLabel(sinceIso: string, nowMs: number = Date.now()) {
  const { minutes, seconds } = elapsedParts(sinceIso, nowMs)
  return `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`
}

/** Fronter Queue Wait Time — "3 min 12 sec" via moment. */
export function formatWaitTimeMinutesSeconds(sinceIso: string, nowMs: number = Date.now()) {
  const { minutes, seconds } = elapsedParts(sinceIso, nowMs)
  return `${minutes} min ${seconds.toString().padStart(2, '0')} sec`
}

/** Clock time in the user's zone, 12-hour: "09:56:50 PM". */
export function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: displayZone,
  })
}
