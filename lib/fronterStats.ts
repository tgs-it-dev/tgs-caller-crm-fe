import { apiUrl } from '@/lib/apiUrl'
import type { components } from '@/lib/generated/schema'

/** Re-exports from `lib/generated/schema.d.ts` — do not hand-roll parallel DTOs. */
export type InteractionDispositionResponse =
  components['schemas']['InteractionDispositionResponse']
export type FunnelCounts = components['schemas']['FunnelCounts']
export type LeadResponse = components['schemas']['LeadResponse']

/**
 * PROVISIONAL CONTRACT — agent-scoped My Stats is not in the frozen OpenAPI yet
 * (`/reporting/funnel` is admin/company-wide). Row fields come from
 * `InteractionDispositionResponse`; lead display fields stand in until the BE
 * freezes a dedicated list DTO. Swap the fetch path with no UI change when it ships.
 */
export type TodaysDispositionRow = Pick<
  InteractionDispositionResponse,
  'id' | 'interaction_id' | 'created_at' | 'label' | 'stage' | 'actor_user_id'
> & {
  lead_name: string
  lead_phone: LeadResponse['phone_normalized']
}

/** Screen 5 KPIs — typed against generated `FunnelCounts` field semantics. */
export type TodaysStatsSummary = {
  callsToday: FunnelCounts['interactions']
  qualified: FunnelCounts['qualifications']
  transferred: FunnelCounts['transfers_initiated']
}

export type TodaysStatsResponse = {
  dispositions: TodaysDispositionRow[]
  /** Interaction ids this fronter transferred today (subset of dispositions). */
  transferred_interaction_ids: InteractionDispositionResponse['interaction_id'][]
}

export const QUALIFIED_LABEL = 'Qualified — ready to transfer'

/**
 * KPIs are derived only from this user's today payload so tiles match a manual
 * count of the disposition list (+ which of those calls were transferred).
 */
export function summarizeTodaysStats(payload: TodaysStatsResponse): TodaysStatsSummary {
  const transferred = new Set(payload.transferred_interaction_ids)
  const qualifiedRows = payload.dispositions.filter((row) => row.label === QUALIFIED_LABEL)

  return {
    callsToday: payload.dispositions.length,
    qualified: qualifiedRows.length,
    transferred: qualifiedRows.filter((row) => transferred.has(row.interaction_id)).length,
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
  if (!res.ok) throw new Error("Unable to load today's stats right now.")
  return res.json() as Promise<TodaysStatsResponse>
}
