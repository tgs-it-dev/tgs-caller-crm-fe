'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { TodaysDispositionTable } from '@/components/fronter/TodaysDispositionTable'
import { AgentFigureTiles } from '@/components/stats/AgentFigureTiles'
import { AgentSalesTable } from '@/components/stats/AgentSalesTable'
import { PeriodPicker } from '@/components/stats/PeriodPicker'
import { Alert } from '@/components/ui/Alert'
import { PageShell } from '@/components/ui/PageShell'
import {
  CURRENT_DAY,
  fetchMyStats,
  type AgentStatsReport,
  type PeriodChoice,
} from '@/lib/agentStats'
import { deskRoleFromPath } from '@/lib/auth'
import { displayTimeZone } from '@/lib/format'
import {
  fetchTodaysStats,
  statsStageForUser,
  type TodaysDispositionRow,
} from '@/lib/fronterStats'
import { waitForMocking } from '@/lib/mockReady'
import { businessDay } from '@/lib/reporting'
import { withSession } from '@/lib/session'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: AgentStatsReport }

const UNAVAILABLE = 'Unable to load your stats right now.'

/**
 * My Stats for a fronter or a closer: their figures for a day, a week or a
 * month, today's outcomes on the current day, and a closer's policies.
 */
export function MyStatsScreen() {
  const pathname = usePathname()
  const { user, status: userStatus } = useCurrentUser()
  const stage = user ? statsStageForUser(user.roles, deskRoleFromPath(pathname)) : null
  const [choice, setChoice] = useState<PeriodChoice>(CURRENT_DAY)
  const [fetchState, setFetchState] = useState<LoadState>({ status: 'loading' })
  const [todayRows, setTodayRows] = useState<TodaysDispositionRow[] | null>(null)

  function choose(next: PeriodChoice) {
    setChoice(next)
    setFetchState({ status: 'loading' })
  }

  useEffect(() => {
    if (userStatus === 'loading' || !user) return
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => fetchMyStats(choice, stage, token)))
      .then((report) => {
        if (!cancelled) setFetchState({ status: 'ready', report })
      })
      .catch(() => {
        if (!cancelled) setFetchState({ status: 'error', message: UNAVAILABLE })
      })

    return () => {
      cancelled = true
    }
  }, [userStatus, user, stage, choice])

  // Today's outcomes, one by one: read once, shown on the current day.
  useEffect(() => {
    if (userStatus === 'loading' || !user) return
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => fetchTodaysStats(token, stage)))
      .then((payload) => {
        if (!cancelled) setTodayRows(payload.dispositions)
      })
      // The figures still show without the list.
      .catch(() => {
        if (!cancelled) setTodayRows(null)
      })

    return () => {
      cancelled = true
    }
  }, [userStatus, user, stage])

  // Derived, not effect-driven: a missing user is known synchronously once
  // userStatus settles, so there's nothing to wait a render on.
  const load: LoadState =
    !user && userStatus !== 'loading' ? { status: 'error', message: UNAVAILABLE } : fetchState
  const report = load.status === 'ready' ? load.report : null
  const today = businessDay(new Date(), report?.timezone ?? displayTimeZone())
  const row = report?.agents[0]
  const onToday = report?.period === 'today' && report.start === today

  return (
    <PageShell title="My Stats">
      <div className="flex flex-col gap-5">
        <PeriodPicker choice={choice} shown={report} today={today} onChange={choose} />

        {load.status === 'loading' && (
          <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
            Loading your stats…
          </p>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}
        {report && row && <AgentFigureTiles row={row} period={report.period} />}

        {stage === 'closer' && <AgentSalesTable userId={null} stage="closer" choice={choice} />}
        {onToday && todayRows && <TodaysDispositionTable rows={todayRows} />}
      </div>
    </PageShell>
  )
}
