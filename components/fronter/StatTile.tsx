import type { ReactNode } from 'react'

/**
 * Metric card from Figma "Fronter - My Stats" (`Frame 1000007931`):
 * 20px padding, 20px gap, 12px radius, 0.5px slate hairline.
 */
export function StatTile({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 rounded-xl border-hairline border-slate bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center text-body-text [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
        <p className="text-sm leading-[150%] text-body-text">{label}</p>
      </div>
      <p className="text-[32px] font-semibold leading-[120%] text-ink">{value}</p>
    </div>
  )
}
