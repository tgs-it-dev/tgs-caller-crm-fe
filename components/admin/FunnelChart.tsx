import type { FunnelStage, HistoricalFunnel } from '@/lib/reporting'

/** What each bar is called, and what the list drilling into one is titled. */
export const STAGE_LABEL: Record<FunnelStage, string> = {
  attempts: 'Attempts',
  connects: 'Connects',
  qualified: 'Qualified',
  // Not the design's "Transferred". A transfer attempt is what the data can
  // show: rejected and timed-out transfers are in this number, and whether a
  // closer reached the lead isn't recorded anywhere.
  transfer_attempts: 'Transfer Attempts',
}

const STAGES = [
  { field: 'attempts', fill: 'bg-funnel-attempts' },
  { field: 'connects', fill: 'bg-funnel-connects' },
  { field: 'qualified', fill: 'bg-funnel-qualified' },
  { field: 'transfer_attempts', fill: 'bg-funnel-transfers' },
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
  const peak = Math.max(...STAGES.map(({ field }) => funnel[field]))

  if (peak === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate">
        No interactions in this range. Widen the dates to look further back.
      </p>
    )
  }

  return (
    <>
      <ol className="space-y-4">
        {STAGES.map(({ field, fill }) => {
          const count = funnel[field]
          // Measured against the largest count rather than attempts: the stages
          // are meant to narrow, but nothing enforces it, and a figure is never
          // reshaped to suggest they did.
          const width = count === 0 ? 0 : Math.max(2, Math.min(100, (count / peak) * 100))
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
        Connects counts interactions with at least one call leg; Qualified, those with a
        qualification captured — not that the lead qualified; Transfer Attempts includes transfers a
        closer rejected or that timed out. Figures stay provisional until dialer call events are
        mapped.
      </p>
    </>
  )
}
