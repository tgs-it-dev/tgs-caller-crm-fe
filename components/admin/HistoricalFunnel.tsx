'use client'

import { useEffect, useState } from 'react'
import { DateRangePicker } from '@/components/admin/DateRangePicker'
import { FunnelChart } from '@/components/admin/FunnelChart'
import { Alert } from '@/components/ui/Alert'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { formatDayRange, formatZone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  businessDay,
  fetchFunnel,
  todayRange,
  type DateRange,
  type HistoricalFunnel as Funnel,
} from '@/lib/reporting'
import { withSession } from '@/lib/session'

/** A window the page chose rather than the user, and so one it may still correct. */
type Selection = { range: DateRange; auto: boolean }

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; funnel: Funnel }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) return 'You no longer have access to reports.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load the funnel for this range.'
}

export function HistoricalFunnel() {
  const [selected, setSelected] = useState<Selection>(() => ({
    range: todayRange(),
    auto: true,
  }))
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  // Bumped only when the page moves the window itself, to start the date fields
  // again from it. A window the user picked leaves their fields alone.
  const [pageMoved, setPageMoved] = useState(0)
  // The business zone, once a reply has named it. Until then the browser's days
  // are the only ones on hand.
  const [zone, setZone] = useState<string | undefined>(undefined)

  /** Read a different window. The figures on screen answered the old one. */
  const select = (next: Selection) => {
    setSelected(next)
    setLoad({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => fetchFunnel(selected.range, token)))
      .then((funnel) => {
        if (cancelled) return
        setZone(funnel.timezone)

        // The page opens on today, and before the first reply there was no
        // business zone to say which day that is — so it used the browser's.
        // Where the two disagree these figures cover a day nobody asked for:
        // they're dropped and the right one read instead, leaving the page
        // loading rather than showing them.
        if (selected.auto) {
          const corrected = todayRange(funnel.timezone)
          if (corrected.start !== selected.range.start || corrected.end !== selected.range.end) {
            setPageMoved((moved) => moved + 1)
            select({ range: corrected, auto: true })
            return
          }
        }

        setLoad({ status: 'ready', funnel })
      })
      // Figures never outlive the range they answer, or the access that allowed them.
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [selected])

  return (
    <PageShell title="Reports">
      <section className="rounded-xl border-hairline border-slate bg-white p-5">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b-hairline border-light-grey pb-4">
          <div>
            <h2 className="text-lg font-medium leading-[120%] text-ink">Conversion funnel</h2>
            {load.status === 'ready' && (
              // The window and zone the figures on screen came back for.
              <p className="mt-1 text-sm leading-[120%] text-slate">
                {formatDayRange(load.funnel.start, load.funnel.end)} ·{' '}
                {formatZone(load.funnel.end, load.funnel.timezone)}
              </p>
            )}
          </div>

          <DateRangePicker
            key={pageMoved}
            range={selected.range}
            max={businessDay(new Date(), zone)}
            onChange={(range) => select({ range, auto: false })}
          />
        </header>

        {load.status === 'loading' && (
          <p className="py-10 text-center text-sm text-slate">Loading the funnel…</p>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}
        {load.status === 'ready' && <FunnelChart funnel={load.funnel} />}
      </section>
    </PageShell>
  )
}
