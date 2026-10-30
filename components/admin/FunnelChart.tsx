import { formatPercent } from '@/lib/format'
import type { FunnelStage, HistoricalFunnel } from '@/lib/reporting'

/** What each bar is called, and what the list behind one is titled. */
export const STAGE_LABEL: Record<FunnelStage, string> = {
  leads: 'Leads',
  qualified: 'Qualified',
  // Doesn't claim the closer reached the lead; the caption says so.
  transferred: 'Transferred',
  sold: 'Sold',
}

const STAGES = [
  { field: 'leads', fill: 'bg-funnel-leads' },
  { field: 'qualified', fill: 'bg-funnel-qualified' },
  { field: 'transferred', fill: 'bg-funnel-transferred' },
  { field: 'sold', fill: 'bg-funnel-sold' },
] as const satisfies readonly { field: FunnelStage; fill: string }[]

export function FunnelChart({
  funnel,
  stage,
  onStageChange,
  listId,
}: {
  funnel: HistoricalFunnel
  /** Which bar the list below is showing. */
  stage: FunnelStage
  onStageChange: (stage: FunnelStage) => void
  /** The list these bars scope, when one is on screen. */
  listId?: string
}) {
  if (funnel.leads === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate">
        No leads were added in these dates. Widen the dates to look further back.
      </p>
    )
  }

  return (
    <>
      <ol className="space-y-4">
        {STAGES.map(({ field, fill }) => {
          const count = funnel[field]
          // Each stage sits inside Leads, so its share of Leads is also its width.
          const share = count / funnel.leads
          const width = count === 0 ? 0 : Math.max(2, share * 100)
          const selected = field === stage

          return (
            <li key={field}>
              {/* The button is inside the <li>, not around it, so the list stays
                  a list. A bar reading zero is still clickable: opening it and
                  finding nothing is how a zero gets confirmed rather than
                  wondered about. The negative margins give the highlight room
                  without moving the bars, so the measured rhythm is unchanged. */}
              <button
                type="button"
                onClick={() => onStageChange(field)}
                aria-pressed={selected}
                // Focus stays here while the list rewrites itself, so this is
                // all that connects the two for a reader who can't see it.
                aria-controls={listId}
                className={`-mx-2 -my-1.5 flex w-full items-center gap-4 rounded-lg px-2 py-1.5 text-left transition ${
                  selected ? 'bg-nav-active' : 'hover:bg-slate/10'
                }`}
              >
                <span className="w-36 shrink-0 text-sm leading-[120%] text-body-text">
                  {STAGE_LABEL[field]}
                </span>
                <span className="h-7 flex-1 rounded bg-shop-floor">
                  <span
                    className={`block h-full rounded ${fill}`}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-sm text-slate tabular-nums">
                  {field === 'leads' ? '' : formatPercent(share)}
                </span>
                <span className="w-24 shrink-0 text-right text-lg font-semibold leading-none text-ink tabular-nums">
                  {count.toLocaleString()}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Said here rather than in hover text, which a screen reader never reads. */}
      <p className="mt-5 text-xs leading-[150%] text-slate">
        These are the leads added during these dates, each counted once at the furthest stage it
        has reached. Qualified means its latest fronter outcome qualifies it, Transferred that a
        closer accepted it (not that they reached the lead, which isn’t recorded), and Sold that
        one of its calls ended in a sale. Percentages are of Leads.
      </p>
    </>
  )
}
