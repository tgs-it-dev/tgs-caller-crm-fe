import type { components, paths } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import { formatDay, formatDayRange } from '@/lib/format'
import type { StatsStage } from '@/lib/fronterStats'
import { formatMonth } from '@/lib/policies'

export type AgentStatsReport = components['schemas']['AgentStatsResponse']
export type AgentStats = components['schemas']['AgentStats']
export type FronterFigures = components['schemas']['FronterFigures']
export type CloserFigures = components['schemas']['CloserFigures']
export type AgentTargets = components['schemas']['AgentTargets']
export type AgentSaleItem = components['schemas']['AgentSaleItem']
export type AgentSaleList = components['schemas']['AgentSaleListResponse']
export type AgentLeadItem = components['schemas']['AgentLeadItem']
export type AgentLeadList = components['schemas']['AgentLeadListResponse']
export type AgentPeriod = AgentStatsReport['period']
export type AgentSaleKind = NonNullable<
  paths['/me/stats/sales']['get']['parameters']['query']
>['kind']

/** The period on screen: its kind, and a day inside it. Null is the one holding today. */
export type PeriodChoice = { period: AgentPeriod; day: string | null }

/** The dates the server answered for, which name the period on screen. */
export type PeriodShown = Pick<AgentStatsReport, 'period' | 'start' | 'end'>

export const CURRENT_DAY: PeriodChoice = { period: 'today', day: null }

export const PERIOD_OPTIONS: readonly { value: AgentPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

export const SALE_KIND_LABEL: Record<AgentSaleKind, string> = {
  sold: 'Sold',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

/** "Nov 6, 2026", "Nov 2 - Nov 8, 2026" or "November 2026". */
export function periodLabel({ period, start, end }: PeriodShown): string {
  if (period === 'today') return formatDay(start)
  if (period === 'week') return formatDayRange(start, end)
  return formatMonth(start)
}

function shiftDay(day: string, by: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + by)
  return date.toISOString().slice(0, 10)
}

/** A day in the period before the one shown. */
export function earlierDay(shown: PeriodShown): string {
  return shiftDay(shown.start, -1)
}

/** A day in the period after the one shown, or null when that would be after today. */
export function laterDay(shown: PeriodShown, today: string): string | null {
  const next = shiftDay(shown.end, 1)
  return next > today ? null : next
}

/** The target for the figure the period is measured on, null when none is set. */
export function targetOf(row: AgentStats): { done: number; target: number | null } {
  if (row.fronter) return { done: row.fronter.qualifications, target: row.fronter.target }
  return { done: row.closer?.sold ?? 0, target: row.closer?.target ?? null }
}

function periodQuery(choice: PeriodChoice, extra: Record<string, string> = {}): URLSearchParams {
  const query = new URLSearchParams({ period: choice.period, ...extra })
  if (choice.day) query.set('date', choice.day)
  return query
}

async function read<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

export type Page = { limit: number; offset: number }

function pageOf({ limit, offset }: Page): Record<string, string> {
  return { limit: String(limit), offset: String(offset) }
}

/** The signed-in agent's own figures. Pass the stage for someone who is both. */
export function fetchMyStats(
  choice: PeriodChoice,
  stage: StatsStage | null,
  token: string
): Promise<AgentStatsReport> {
  const query = periodQuery(choice, stage ? { stage } : {})
  return read<AgentStatsReport>(`/me/stats?${query}`, token)
}

/** The signed-in closer's own sales behind one figure, with no amounts. */
export function fetchMySales(
  choice: PeriodChoice,
  kind: AgentSaleKind,
  page: Page,
  token: string
): Promise<AgentSaleList> {
  const query = periodQuery(choice, { kind, ...pageOf(page) })
  return read<AgentSaleList>(`/me/stats/sales?${query}`, token)
}

/** Every fronter or closer the admin may see, or one when `agentId` is set. */
export function fetchAgentStats(
  choice: PeriodChoice,
  filter: { stage: StatsStage; teamId: string | null; agentId: string | null },
  token: string
): Promise<AgentStatsReport> {
  const query = periodQuery(choice, { stage: filter.stage })
  if (filter.teamId) query.set('team_id', filter.teamId)
  if (filter.agentId) query.set('agent_id', filter.agentId)
  return read<AgentStatsReport>(`/reporting/agents?${query}`, token)
}

/** One agent's sales behind a figure. Amounts come back for a Super Admin only. */
export function fetchAgentSales(
  userId: string,
  stage: StatsStage,
  choice: PeriodChoice,
  kind: AgentSaleKind,
  page: Page,
  token: string
): Promise<AgentSaleList> {
  const query = periodQuery(choice, { stage, kind, ...pageOf(page) })
  return read<AgentSaleList>(`/reporting/agents/${userId}/sales?${query}`, token)
}

/** The leads one agent worked in the period, newest first. */
export function fetchAgentLeads(
  userId: string,
  stage: StatsStage,
  choice: PeriodChoice,
  page: Page,
  token: string
): Promise<AgentLeadList> {
  const query = periodQuery(choice, { stage, ...pageOf(page) })
  return read<AgentLeadList>(`/reporting/agents/${userId}/leads?${query}`, token)
}

/** All three at once; a null clears that one. */
export function saveAgentTargets(
  userId: string,
  stage: StatsStage,
  targets: AgentTargets,
  token: string
): Promise<AgentTargets> {
  return read<AgentTargets>(`/reporting/agents/${userId}/targets`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, ...targets }),
  })
}
