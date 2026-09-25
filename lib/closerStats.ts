import type { TodaysStatsResponse } from '@/lib/fronterStats'

export {
  fetchTodaysStats,
  formatDispositionTime,
  statsStageForUser,
  type StatsStage,
  type TodaysDispositionRow,
  type TodaysStatsResponse,
} from '@/lib/fronterStats'

/** Screen KPIs — mapped from BE summary fields on TodaysStatsResponse. */
export type CloserTodaysStatsSummary = {
  callsToday: number
  sales: number
  transferred: number
}

/**
 * KPIs from the closer today payload. Prefer the server counts:
 * - calls_today includes accepted-but-not-yet-dispositioned transfers
 * - sales uses catalogue counts_as_sale (not a hard-coded label)
 * - calls_transferred is answered+dispositioned today
 */
export function summarizeCloserTodaysStats(
  payload: TodaysStatsResponse
): CloserTodaysStatsSummary {
  return {
    callsToday: payload.calls_today,
    sales: payload.sales,
    transferred: payload.calls_transferred,
  }
}
