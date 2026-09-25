import type { TodaysStatsResponse } from '@/lib/fronterStats'

export {
  fetchTodaysStats,
  formatDispositionTime,
  statsStageForUser,
  type StatsStage,
  type TodaysDispositionRow,
  type TodaysStatsResponse,
} from '@/lib/fronterStats'

/** Screen KPIs — derived from the closer-scoped today payload. */
export type CloserTodaysStatsSummary = {
  callsToday: number
  sales: number
  transferred: number
}

/**
 * Catalogue label that counts as Sales on closer My Stats.
 * Matches the closer disposition seed in mocks / BE catalogue.
 */
export const SALE_COMPLETED_LABEL = 'Sale completed'

/**
 * KPIs from this closer's today payload: disposition rows for Calls/Sales,
 * and transferred ids for answered+dispositioned transfers today.
 */
export function summarizeCloserTodaysStats(
  payload: TodaysStatsResponse
): CloserTodaysStatsSummary {
  return {
    callsToday: payload.dispositions.length,
    sales: payload.dispositions.filter((row) => row.label === SALE_COMPLETED_LABEL).length,
    transferred: payload.transferred_interaction_ids.length,
  }
}
