'use client'

import { useEffect, useState } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { QueueRow } from '@/components/fronter/QueueRow'
import { StatTile } from '@/components/fronter/StatTile'
import { readToken } from '@/lib/auth'
import { InteractionDetail, listInteractions } from '@/lib/interactions'
import { waitForMocking } from '@/lib/mockReady'

type QueueState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; queue: InteractionDetail[] }

export default function FronterPage() {
  return (
    <RequireRole role="fronter">
      <Dashboard />
    </RequireRole>
  )
}

function Dashboard() {
  const { user, status: userStatus } = useCurrentUser()
  const [queueState, setQueueState] = useState<QueueState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const token = readToken()
    if (!token) return

    waitForMocking()
      .then(() => listInteractions(token))
      .then((queue) => {
        if (cancelled) return
        setQueueState({ status: 'ready', queue })
      })
      .catch(() => {
        if (cancelled) return
        setQueueState({ status: 'error', message: 'Unable to load your queue right now.' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (userStatus === 'loading' || queueState.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shop-floor">
        <p className="text-sm text-slate">Loading your desk…</p>
      </div>
    )
  }

  if (userStatus === 'error' || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shop-floor px-4">
        <div className="w-full max-w-sm">
          <Alert>Unable to load your profile right now.</Alert>
        </div>
      </div>
    )
  }

  if (queueState.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shop-floor px-4">
        <div className="w-full max-w-sm">
          <Alert>{queueState.message}</Alert>
        </div>
      </div>
    )
  }

  const { queue } = queueState
  const activeCount = queue.filter((i) => i.status === 'active').length
  const wrapUpCount = queue.filter((i) => i.status === 'wrap_up').length

  return (
    <main className="min-h-screen bg-shop-floor px-4 py-10 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm text-slate">Welcome back</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{user.name}</h1>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="In queue" value={queue.length} />
          <StatTile label="Live calls" value={activeCount} />
          <StatTile label="Wrap-up" value={wrapUpCount} />
        </div>

        <h2 className="mb-3 text-sm font-semibold text-ink">Your queue</h2>

        {queue.length === 0 ? (
          <p className="rounded-xl border border-slate/20 bg-white px-4 py-8 text-center text-sm text-slate">
            No calls waiting right now.
          </p>
        ) : (
          <div className="space-y-2">
            {queue.map((interaction) => (
              <QueueRow key={interaction.id} interaction={interaction} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
