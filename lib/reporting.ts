import type { components, paths } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type HistoricalFunnel = components['schemas']['HistoricalFunnel']

/** The four stages, from the contract — the union is inline in the operation. */
export type FunnelStage =
  paths['/reporting/funnel/{stage}']['get']['parameters']['path']['stage']

export type FunnelInteraction = components['schemas']['FunnelInteraction']
export type FunnelInteractionList = components['schemas']['FunnelInteractionListResponse']

/** An inclusive range of business days, each as `YYYY-MM-DD`. */
export type DateRange = { start: string; end: string }

/**
 * Zones an administrator can ask the funnel to count in.
 *
 * Any IANA name the server knows is valid; this is only the menu. The reply's
 * zone is always offered too, so a configured business day outside the list
 * still appears as the current choice.
 */
export const REPORT_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'UTC',
  'Europe/London',
  'Asia/Karachi',
] as const

/** Menu options for a funnel reply — curated list plus the zone on screen. */
export function reportTimezoneOptions(current: string): string[] {
  if ((REPORT_TIMEZONES as readonly string[]).includes(current)) {
    return [...REPORT_TIMEZONES]
  }
  return [current, ...REPORT_TIMEZONES]
}

/**
 * Funnel counts for a range of business days.
 *
 * Omit `timezone` on the first read so the server names the configured
 * business day. Pass one after that when someone deliberately picks another
 * region — the same dates mean a different cohort under a different zone.
 */
export async function fetchFunnel(
  range: DateRange,
  token: string,
  timezone?: string
): Promise<HistoricalFunnel> {
  const query = new URLSearchParams(range)
  if (timezone) query.set('timezone', timezone)
  const res = await fetch(apiUrl(`/reporting/funnel?${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<HistoricalFunnel>
}

/**
 * One page of the interactions behind a funnel number.
 *
 * Takes the funnel rather than its dates, and unlike `fetchFunnel` does send
 * `timezone`: the aggregate names the zone it counted in, and only sending that
 * back keeps `total` equal to the figure on screen.
 */
export async function fetchFunnelStage(
  stage: FunnelStage,
  funnel: HistoricalFunnel,
  page: { limit: number; offset: number },
  token: string
): Promise<FunnelInteractionList> {
  const query = new URLSearchParams({
    start: funnel.start,
    end: funnel.end,
    timezone: funnel.timezone,
    limit: String(page.limit),
    offset: String(page.offset),
  })
  const res = await fetch(apiUrl(`/reporting/funnel/${stage}?${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<FunnelInteractionList>
}

/** The calendar day `date` falls on in `timeZone`, or in the browser's without one. */
export function businessDay(date: Date, timeZone?: string): string {
  // en-CA writes YYYY-MM-DD, which is what the API takes.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
}

/** One calendar day before an ISO `YYYY-MM-DD`, in UTC so the zone never shifts it. */
function dayBefore(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/** Yesterday through today — the window the reports page opens on. */
export function defaultRange(timeZone?: string): DateRange {
  const today = businessDay(new Date(), timeZone)
  return { start: dayBefore(today), end: today }
}
