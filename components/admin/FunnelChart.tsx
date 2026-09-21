import type { HistoricalFunnel } from '@/lib/reporting'

const STAGES = [
  { label: 'Attempts', field: 'attempts', fill: 'bg-funnel-attempts' },
  { label: 'Connects', field: 'connects', fill: 'bg-funnel-connects' },
  { label: 'Qualified', field: 'qualified', fill: 'bg-funnel-qualified' },
  // Not the design's "Transferred". A transfer attempt is what the data can
  // show: rejected and timed-out transfers are in this number, and whether a
  // closer reached the lead isn't recorded anywhere.
  { label: 'Transfer Attempts', field: 'transfer_attempts', fill: 'bg-funnel-transfers' },
] as const

export function FunnelChart({ funnel }: { funnel: HistoricalFunnel }) {
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
        {STAGES.map(({ label, field, fill }) => {
          const count = funnel[field]
          // Measured against the largest count rather than attempts: the stages
          // are meant to narrow, but nothing enforces it, and a figure is never
          // reshaped to suggest they did.
          const width = count === 0 ? 0 : Math.max(2, Math.min(100, (count / peak) * 100))

          return (
            <li key={field} className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm leading-[120%] text-body-text">{label}</span>
              <span className="h-7 flex-1 rounded bg-shop-floor">
                <span
                  className={`block h-full rounded ${fill}`}
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-lg font-semibold leading-none text-ink tabular-nums">
                {count.toLocaleString()}
              </span>
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
