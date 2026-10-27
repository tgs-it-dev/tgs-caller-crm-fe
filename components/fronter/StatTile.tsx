import type { ReactNode } from 'react'

/**
 * Metric card from Figma "Fronter - My Stats" (`Frame 1000007931`):
 * 20px padding, 20px gap, 12px radius, 0.5px slate hairline. The value sits at
 * the foot, so a row of tiles still lines up when one label wraps.
 */
export function StatTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: number | string
  /** A note on the figure's own line, such as what a rate was worked out of. */
  detail?: string
  icon: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-5 rounded-xl border-hairline border-slate bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center text-body-text [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
        <p className="text-sm leading-[150%] text-body-text">{label}</p>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[32px] font-semibold leading-[120%] text-ink">{value}</span>
        {detail && <span className="text-sm leading-[150%] text-body-text">{detail}</span>}
      </p>
    </div>
  )
}
