export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return phone
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** A time of day in the given zone, named — "2:14 PM EDT" — so it reads the same anywhere. */
export function formatTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
  const seconds = Math.max(0, Math.floor((nowMs - new Date(sinceIso).getTime()) / 1000))
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 }
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
