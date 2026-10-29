import type { ReactNode } from 'react'

/**
 * Metric card matching LiveCounters / StatTile: white tile, icon+label on
 * top, figure at the foot. Clicking filters the list; selected = navy border.
 */
export function StatCard({
  label,
  count,
  icon,
  selected,
  onClick,
}: {
  label: string
  count: number
  icon: ReactNode
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'flex flex-col justify-between rounded-xl border-hairline bg-white p-5 text-left transition-colors',
        selected
          ? 'border-navy shadow-[0_0_0_1px_#1F3A5F]'
          : 'border-slate hover:border-navy/40',
      ].join(' ')}
    >
      <p className="flex items-center gap-2 text-sm leading-[120%] text-body-text">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-6 text-[32px] font-semibold leading-none text-ink tabular-nums">{count}</p>
    </button>
  )
}
