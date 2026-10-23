import type { components, paths } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import { displayTimeZone } from '@/lib/format'

export type HistoricalFunnel = components['schemas']['HistoricalFunnel']

/** The four stages, from the contract — the union is inline in the operation. */
export type FunnelStage =
  paths['/reporting/funnel/{stage}']['get']['parameters']['path']['stage']

export type FunnelInteraction = components['schemas']['FunnelInteraction']
export type FunnelInteractionList = components['schemas']['FunnelInteractionListResponse']

/** An inclusive range of business days, each as `YYYY-MM-DD`. */
export type DateRange = { start: string; end: string }

/**
 * Funnel counts for a range of days.
 *
 * No `timezone` is sent: the server counts in the signed-in user's own zone
 * and names it in the reply.
 */
export async function fetchFunnel(range: DateRange, token: string): Promise<HistoricalFunnel> {
  const query = new URLSearchParams(range)
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

/** The calendar day `date` falls on in `timeZone` (the user's zone when omitted). */
export function businessDay(date: Date, timeZone: string = displayTimeZone()): string {
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
export function defaultRange(timeZone: string = displayTimeZone()): DateRange {
  const today = businessDay(new Date(), timeZone)
  return { start: dayBefore(today), end: today }
}
