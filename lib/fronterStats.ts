import { apiUrl } from '@/lib/apiUrl'
import { readApiError } from '@/lib/apiError'
import { AuthError, type Role } from '@/lib/auth'
import { formatClockTime } from '@/lib/format'
import type { components } from '@/lib/generated/schema'

export type TodaysDispositionRow = components['schemas']['TodaysDispositionRow']
export type TodaysStatsResponse = components['schemas']['TodaysStatsResponse']

/** Screen 5 KPIs — derived from the agent-scoped today payload. */
export type TodaysStatsSummary = {
  callsToday: number
  qualified: number
  transferred: number
}

/**
 * Catalogue label that counts as Qualified on fronter My Stats.
 * BE `sales` is counts_as_sale (closer "Sale" only) — not the fronter
 * Qualified tile — so this stays a label count until the contract adds one.
 * Matches the fronter seed in `tgs-caller-crm-be/scripts/seed.py`.
 */
export const QUALIFIED_LABEL = 'Qualified - Transferred'

/**
 * KPIs from this fronter's today payload. Calls/Transferred come from the
 * server summary fields; Qualified is still derived from disposition labels.
 */
export function summarizeTodaysStats(payload: TodaysStatsResponse): TodaysStatsSummary {
  return {
    callsToday: payload.calls_today,
    qualified: payload.dispositions.filter((row) => row.label === QUALIFIED_LABEL).length,
    transferred: payload.calls_transferred,
  }
}

export function formatDispositionTime(iso: string) {
  return formatClockTime(iso)
}

export type StatsStage = TodaysDispositionRow['stage']

function isStatsStage(role: Role): role is StatsStage {
  return role === 'fronter' || role === 'closer'
}

/**
 * Resolve `/me/stats/today` stage from `GET /auth/me` roles.
 *
 * - One agent role → that stage (BE also allows omitting stage in this case).
 * - Both fronter + closer → desk URL disambiguates (required by BE).
 * - Neither (admin-only) → null.
 *
 * Do not persist roles in localStorage — `CurrentUserProvider` already caches
 * the `/auth/me` payload for the tab.
 */
export function statsStageForUser(
  roles: Role[],
  desk?: Role | null
): StatsStage | null {
  const agentRoles = roles.filter(isStatsStage)
  if (agentRoles.length === 1) return agentRoles[0]
  if (agentRoles.length > 1 && desk && isStatsStage(desk)) return desk
  return null
}

/**
 * Agent-scoped today payload. Pass stage from `statsStageForUser(user.roles, desk)`
 * so dual-role callers stay correct; omit only when stage is null/undefined.
 */
export async function fetchTodaysStats(
  token: string,
  stage?: StatsStage | null
): Promise<TodaysStatsResponse> {
  const path = stage ? `/me/stats/today?stage=${stage}` : '/me/stats/today'
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const { status, code, message, fields } = await readApiError(res)
    throw new AuthError(message, status, code, fields)
  }
  return res.json() as Promise<TodaysStatsResponse>
}
