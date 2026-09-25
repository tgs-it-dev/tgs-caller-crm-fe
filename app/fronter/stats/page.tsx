'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { RequireRole } from '@/components/auth/RequireRole'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { StatTile } from '@/components/fronter/StatTile'
import { TodaysDispositionTable } from '@/components/fronter/TodaysDispositionTable'
import { Alert } from '@/components/ui/Alert'
import { PageShell } from '@/components/ui/PageShell'
import { deskRoleFromPath } from '@/lib/auth'
import {
  fetchTodaysStats,
  statsStageForUser,
  summarizeTodaysStats,
  type TodaysDispositionRow,
  type TodaysStatsSummary,
} from '@/lib/fronterStats'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

/** Lucide `Phone` — Figma My Stats "Calls Today". */
function CallsTodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Lucide `CircleCheck` — Figma My Stats "Qualified". */
function QualifiedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Lucide `ArrowLeftRight` — Figma My Stats "Transferred". */
function TransferredIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 3 4 7l4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 7h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m16 21 4-4-4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 17H4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      rows: TodaysDispositionRow[]
      summary: TodaysStatsSummary
    }

export default function FronterStatsPage() {
  return (
    <RequireRole role="fronter">
      <MyStats />
    </RequireRole>
  )
}

function MyStats() {
  const pathname = usePathname()
  const { user, status: userStatus } = useCurrentUser()
  const desk = deskRoleFromPath(pathname)
  const stage = user ? statsStageForUser(user.roles, desk) : null
  const [fetchState, setFetchState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (userStatus === 'loading' || !user) return

    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => fetchTodaysStats(token, stage)))
      .then((payload) => {
        if (cancelled) return
        setFetchState({
          status: 'ready',
          rows: payload.dispositions,
          summary: summarizeTodaysStats(payload),
        })
      })
      .catch(() => {
        if (!cancelled) {
          setFetchState({ status: 'error', message: "Unable to load today's stats right now." })
        }
      })

    return () => {
      cancelled = true
    }
  }, [userStatus, user, stage])

  // Derived, not effect-driven: a missing user is known synchronously once
  // userStatus settles, so there's nothing to wait a render on.
  const load: LoadState =
    !user && userStatus !== 'loading'
      ? { status: 'error', message: "Unable to load today's stats right now." }
      : fetchState

  return (
    <PageShell title="My Stats">
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading today&apos;s stats…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-5 sm:flex-row">
            <StatTile
              label="Calls Today"
              value={load.summary.callsToday}
              icon={<CallsTodayIcon />}
            />
            <StatTile
              label="Qualified"
              value={load.summary.qualified}
              icon={<QualifiedIcon />}
            />
            <StatTile
              label="Transferred"
              value={load.summary.transferred}
              icon={<TransferredIcon />}
            />
          </div>

          <TodaysDispositionTable rows={load.rows} />
        </div>
      )}
    </PageShell>
  )
}
