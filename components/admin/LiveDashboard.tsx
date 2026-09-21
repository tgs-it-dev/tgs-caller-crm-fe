'use client'

import { useEffect, useState } from 'react'
import { AgentStatusTable } from '@/components/admin/AgentStatusTable'
import { LiveCounters } from '@/components/admin/LiveCounters'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { PUSH_INTERVAL_MS, watchLiveStatus, type LiveStatus } from '@/lib/liveStatus'

// Three pushes missed: from then on the figures are old, whatever the socket says.
const STALE_AFTER_MS = 3 * PUSH_INTERVAL_MS
const CLOCK_MS = 5000

type Latest = { snapshot: LiveStatus; receivedAt: number }

/** The one part of the page that needs a clock, so only it re-renders with one. */
function FreshnessPill({ receivedAt }: { receivedAt: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => clearInterval(id)
  }, [])

  // Timed by arrival rather than the server's timestamp, so a browser clock that
  // disagrees with the server's can't make stale figures look live.
  return now - receivedAt < STALE_AFTER_MS ? (
    <Badge tone="live" dot>
      Live
    </Badge>
  ) : (
    <Badge>Delayed</Badge>
  )
}

export function LiveDashboard() {
  const [latest, setLatest] = useState<Latest | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      watchLiveStatus({
        onSnapshot: (snapshot) => setLatest({ snapshot, receivedAt: Date.now() }),
        onError: (err) => {
          // The figures go with the access that allowed them.
          setLatest(null)
          setError(
            err.status === 403
              ? 'You no longer have access to the live dashboard.'
              : 'Your session has ended. Please sign in again.'
          )
        },
      }),
    []
  )

  return (
    <PageShell
      title="Dashboard"
      actions={latest && <FreshnessPill receivedAt={latest.receivedAt} />}
    >
      {error && <Alert>{error}</Alert>}

      {!latest && !error && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading the dashboard…
        </p>
      )}

      {latest && (
        <div className="space-y-3">
          <LiveCounters snapshot={latest.snapshot} />
          <AgentStatusTable agents={latest.snapshot.agents} timeZone={latest.snapshot.timezone} />
        </div>
      )}
    </PageShell>
  )
}
