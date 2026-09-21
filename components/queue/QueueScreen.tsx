'use client'

import { useEffect, useState } from 'react'
import { QueueTable } from '@/components/queue/QueueTable'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { readToken } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import {
  listQueue,
  type CloserQueueEntry,
  type FronterQueueEntry,
  type QueueRole,
} from '@/lib/queue'

/** Wait times tick every second; the list itself is refreshed less often. */
const TICK_MS = 1000
const POLL_MS = 15000

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; role: 'fronter'; entries: FronterQueueEntry[] }
  | { status: 'ready'; role: 'closer'; entries: CloserQueueEntry[] }

function QueueBody({ role }: { role: QueueRole }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    const token = readToken()
    if (!token) return

    waitForMocking()
      .then(() =>
        role === 'fronter' ? listQueue(token, 'fronter') : listQueue(token, 'closer')
      )
      .then((entries) => {
        if (cancelled) return
        if (role === 'fronter') {
          setLoad({ status: 'ready', role: 'fronter', entries: entries as FronterQueueEntry[] })
        } else {
          setLoad({ status: 'ready', role: 'closer', entries: entries as CloserQueueEntry[] })
        }
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error', message: 'Unable to load the queue right now.' })
      })

    return () => {
      cancelled = true
    }
  }, [role])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      // Read on every tick, not once: the token is renewed while the page stays open.
      const token = readToken()
      if (!token) return

      const refresh =
        role === 'fronter'
          ? listQueue(token, 'fronter', { bust: true })
          : listQueue(token, 'closer', { bust: true })

      refresh
        .then((entries) => {
          setLoad((prev) => {
            if (prev.status !== 'ready' || prev.role !== role) return prev
            return role === 'fronter'
              ? { status: 'ready', role: 'fronter', entries: entries as FronterQueueEntry[] }
              : { status: 'ready', role: 'closer', entries: entries as CloserQueueEntry[] }
          })
        })
        // A failed refresh keeps the last good snapshot on screen — that's the
        // "cached" half of the card's heading.
        .catch(() => {})
    }, POLL_MS)

    return () => clearInterval(id)
  }, [role])

  if (load.status === 'loading') {
    return (
      <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
        Loading the queue…
      </p>
    )
  }

  if (load.status === 'error') return <Alert>{load.message}</Alert>

  if (load.role === 'fronter') {
    return <QueueTable role="fronter" entries={load.entries} now={now} />
  }

  return <QueueTable role="closer" entries={load.entries} now={now} />
}

/** Shared Queue desk shell — same live badge + table card for both roles. */
export function QueueScreen({ role }: { role: QueueRole }) {
  return (
    <PageShell
      title="Queue"
      actions={
        <Badge tone="live" dot>
          Live
        </Badge>
      }
    >
      <QueueBody role={role} />
    </PageShell>
  )
}
