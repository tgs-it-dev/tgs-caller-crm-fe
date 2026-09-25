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
 * Funnel counts for a range of business days.
 *
 * No `timezone` is sent: a business day is the server's to define, and the
 * answer names the zone it counted in, so a figure says which days it covers.
 */
export async function fetchFunnel(range: DateRange, token: string): Promise<HistoricalFunnel> {
  const res = await fetch(apiUrl(`/reporting/funnel?${new URLSearchParams(range)}`), {
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

/** Today alone, the window the page opens on. */
export function todayRange(timeZone?: string): DateRange {
  const today = businessDay(new Date(), timeZone)
  return { start: today, end: today }
}
