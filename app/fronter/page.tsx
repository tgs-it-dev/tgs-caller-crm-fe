'use client'

import { useEffect, useState } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { QueueTable } from '@/components/fronter/QueueTable'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { readToken } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { QueueEntry, listQueue } from '@/lib/queue'

/** Wait times tick every second; the list itself is refreshed less often. */
const TICK_MS = 1000
const POLL_MS = 15000

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: QueueEntry[] }

export default function FronterQueuePage() {
  return (
    <RequireRole role="fronter">
      <Queue />
    </RequireRole>
  )
}

function Queue() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    const token = readToken()
    if (!token) return

    waitForMocking()
      .then(() => listQueue(token))
      .then((entries) => {
        if (!cancelled) setLoad({ status: 'ready', entries })
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error', message: 'Unable to load the queue right now.' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const token = readToken()
    if (!token) return

    const id = setInterval(() => {
      listQueue(token)
        .then((entries) => {
          setLoad((prev) => (prev.status === 'ready' ? { ...prev, entries } : prev))
        })
        // A failed refresh keeps the last good snapshot on screen — that's the
        // "cached" half of the card's heading.
        .catch(() => {})
    }, POLL_MS)

    return () => clearInterval(id)
  }, [])

  return (
    <PageShell
      title="Queue"
      actions={
        <Badge tone="live" dot>
          Live
        </Badge>
      }
    >
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading the queue…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && <QueueTable entries={load.entries} now={now} />}
    </PageShell>
  )
}
