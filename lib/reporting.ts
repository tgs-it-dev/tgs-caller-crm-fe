import type { components, paths } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import { displayTimeZone } from '@/lib/format'

export type HistoricalFunnel = components['schemas']['HistoricalFunnel']

/** The four stages, from the contract — the union is inline in the operation. */
export type FunnelStage =
  paths['/reporting/funnel/{stage}']['get']['parameters']['path']['stage']

export type FunnelLead = components['schemas']['FunnelLead']
export type FunnelLeadList = components['schemas']['FunnelLeadListResponse']

export type TeamStatsReport = components['schemas']['TeamStatsResponse']
export type TeamStats = components['schemas']['TeamStats']
export type TeamFigures = components['schemas']['TeamFigures']

export type SalesReport = components['schemas']['SalesReportResponse']
export type SaleItem = components['schemas']['SaleItem']
export type SalesTotals = components['schemas']['SalesTotals']

/** Narrows the sales list; any filter left null is not applied. */
export type SalesQuery = {
  teamId: string | null
  closerId: string | null
  limit: number
  offset: number
}

/** An inclusive range of business days, each as `YYYY-MM-DD`. */
export type DateRange = { start: string; end: string }

/**
 * The leads added in a range of days, by the furthest stage each reached. A
 * Super Admin may name one team; anyone else always gets their own.
 *
 * No `timezone` is sent: the server counts in the signed-in user's own zone
 * and names it in the reply.
 */
export async function fetchFunnel(
  range: DateRange,
  teamId: string | null,
  token: string
): Promise<HistoricalFunnel> {
  const query = new URLSearchParams(range)
  if (teamId) query.set('team_id', teamId)
  const res = await fetch(apiUrl(`/reporting/funnel?${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<HistoricalFunnel>
}

/**
 * One page of the leads behind a funnel number.
 *
 * Takes the funnel rather than its dates, and unlike `fetchFunnel` does send
 * `timezone`: the aggregate names the zone it counted in, and only sending that
 * back, with the same team, keeps `total` equal to the figure on screen.
 */
export async function fetchFunnelStage(
  stage: FunnelStage,
  funnel: HistoricalFunnel,
  teamId: string | null,
  page: { limit: number; offset: number },
  token: string
): Promise<FunnelLeadList> {
  const query = new URLSearchParams({
    start: funnel.start,
    end: funnel.end,
    timezone: funnel.timezone,
    limit: String(page.limit),
    offset: String(page.offset),
  })
  if (teamId) query.set('team_id', teamId)
  const res = await fetch(apiUrl(`/reporting/funnel/${stage}?${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<FunnelLeadList>
}

/**
 * Every team's figures for a range of days, or one team's when `teamId` is set.
 *
 * Super Admin only. Like `fetchFunnel`, no `timezone` is sent: the server
 * counts in the user's own zone and names it in the reply.
 */
export async function fetchTeamStats(
  range: DateRange,
  teamId: string | null,
  token: string
): Promise<TeamStatsReport> {
  const query = new URLSearchParams(range)
  if (teamId) query.set('team_id', teamId)
  const res = await fetch(apiUrl(`/reporting/teams?${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<TeamStatsReport>
}

/**
 * One page of the sales made in a range of days, newest first, with totals across
 * every matching sale. Super Admin only; like the others, no `timezone` is sent.
 */
export async function fetchSales(
  range: DateRange,
  { teamId, closerId, limit, offset }: SalesQuery,
  token: string
): Promise<SalesReport> {
  const query = new URLSearchParams({ ...range, limit: String(limit), offset: String(offset) })
  if (teamId) query.set('team_id', teamId)
  if (closerId) query.set('closer_id', closerId)
  const res = await fetch(apiUrl(`/reporting/sales?${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<SalesReport>
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

/** The first of this month through today, the window team stats opens on. */
export function monthToDate(timeZone: string = displayTimeZone()): DateRange {
  const today = businessDay(new Date(), timeZone)
  return { start: `${today.slice(0, 8)}01`, end: today }
}
