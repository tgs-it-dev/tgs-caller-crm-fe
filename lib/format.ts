import moment from 'moment'

/**
 * Business day for the CRM — US Eastern.
 *
 * Reporting defaults here, and every shared clock/date-time helper draws in
 * this zone so a reader in Karachi sees the same day as the funnel counts.
 * A reports picker may still ask for another IANA name on purpose.
 */
export const BUSINESS_TIMEZONE = 'America/New_York'

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return phone
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Date + time in the business zone, 12-hour — "Sep 23, 2026, 2:14 PM". */
export function formatDateTime(iso: string) {
  return formatDateTimeIn(iso, BUSINESS_TIMEZONE)
}

/**
 * Short name of the business zone right now — "EDT" / "EST".
 *
 * For a table of timestamps, where naming the zone once beside the title says
 * the same thing as repeating it in every cell and leaves room for the data.
 * Kept as `localZoneName` for call-site stability; it is Eastern, not the
 * viewer's laptop.
 */
export function localZoneName(at: Date = new Date()) {
  const named = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    timeZoneName: 'short',
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')
  return named ? named.value : 'ET'
}

/**
 * A full instant in the business zone, named — "Sep 23, 2026, 2:14 PM EDT".
 *
 * For timestamps the API sends without a zone beside them. The abbreviation
 * is part of the string so the time is never read as the laptop's local day.
 */
export function formatInstant(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: BUSINESS_TIMEZONE,
    timeZoneName: 'short',
  })
}

/**
 * An instant drawn in a named zone, the zone left to a caption.
 *
 * Always 12-hour so a locale that prefers 24-hour does not change how rows
 * read. Funnel drill-down passes the reply's zone; elsewhere use
 * `formatDateTime` (Eastern).
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

/** A time of day in the given zone, named — "2:14 PM EDT" — so it reads the same anywhere. */
export function formatTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
    timeZoneName: 'short',
  })
}

/** Calendar day of an instant in the business zone — "Sep 15, 2026". */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: BUSINESS_TIMEZONE,
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

/** What a zone is called on a given day — "EDT" — since that's how times read here. */
export function formatZone(day: string, timeZone: string) {
  const named = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(asUtcDay(day))
    .find((part) => part.type === 'timeZoneName')
  return named ? named.value : timeZone
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

/** Clock time in the business zone, 12-hour — "09:56:50 PM". */
export function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: BUSINESS_TIMEZONE,
  })
}
