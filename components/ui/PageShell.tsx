import { ReactNode } from 'react'

/**
 * The frame every module page sits in: grey backdrop, a "Page Heading" title
 * with optional status content opposite it, a full-bleed rule, then content.
 *
 * Geometry is measured off the Figma Queue frame at 100% zoom:
 *
 * - 24px gutters. The card is pinned at `Left: 24px`, and the title aligns to
 *   that same edge. Deliberately not centred — an `mx-auto max-w-*` turns the
 *   24px gutter into half the leftover space on wide viewports.
 * - The header rule runs edge to edge, not inset with the gutters: it measures
 *   ~24px wider than the card on each side, meeting the content-area edges.
 *   Hence `px-6` living on the header's inner box rather than on `main`.
 * - The rule is a 0.5px `slate` hairline, same as every other rule in the file.
 * - Split 20/20 either side of the rule, which keeps the card's top edge at the
 *   measured 102px.
 */
export function PageShell({
  title,
  actions,
  children,
}: {
  title: string
  /** Status content aligned opposite the title, e.g. a live badge. */
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-shop-floor">
      <div className="border-b-hairline border-slate px-6 pb-5 pt-8">
        <div className="flex items-center justify-between gap-4">
          {/* Figma text style "Page Heading" — 24px / 120%, no letter-spacing. */}
          <h1 className="text-2xl font-semibold leading-[120%] text-ink">{title}</h1>
          {actions}
        </div>
      </div>
      <div className="px-6 pb-8 pt-5">{children}</div>
    </main>
  )
}
