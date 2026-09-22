import { apiUrl } from '@/lib/apiUrl'
import { readApiError } from '@/lib/apiError'
import { AuthError } from '@/lib/auth'
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
 * Catalogue label that counts as Qualified on My Stats.
 * Matches the fronter seed in `tgs-caller-crm-be/scripts/seed.py`.
 */
export const QUALIFIED_LABEL = 'Qualified - Transferred'

/**
 * KPIs from this user's today payload: disposition rows for Calls/Qualified,
 * and the transfer id list for Transferred (attempts initiated today).
 */
export function summarizeTodaysStats(payload: TodaysStatsResponse): TodaysStatsSummary {
  return {
    callsToday: payload.dispositions.length,
    qualified: payload.dispositions.filter((row) => row.label === QUALIFIED_LABEL).length,
    transferred: payload.transferred_interaction_ids.length,
  }
}

export function formatDispositionTime(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export async function fetchTodaysStats(token: string): Promise<TodaysStatsResponse> {
  const res = await fetch(apiUrl('/me/stats/today'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const { status, code, message, fields } = await readApiError(res)
    throw new AuthError(message, status, code, fields)
  }
  return res.json() as Promise<TodaysStatsResponse>
}
