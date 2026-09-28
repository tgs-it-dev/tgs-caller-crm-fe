'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MuiAlert from '@mui/material/Alert'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { QueueTable } from '@/components/queue/QueueTable'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { closerWorkspaceHref } from '@/lib/closer'
import { waitForMocking } from '@/lib/mockReady'
import {
  listQueue,
  type CloserQueueEntry,
  type FronterQueueEntry,
  type QueueRole,
} from '@/lib/queue'
import { withSession } from '@/lib/session'
import { acceptTransfer, rejectTransfer } from '@/lib/transfers'

/** Wait times tick every second; the list itself is refreshed less often. */
const TICK_MS = 1000
/** Fronter queue is dialer-paced; closer offers need faster multi-browser sync. */
const FRONTER_POLL_MS = 15000
const CLOSER_POLL_MS = 3000

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; role: 'fronter'; entries: FronterQueueEntry[] }
  | { status: 'ready'; role: 'closer'; entries: CloserQueueEntry[] }

type BusyAction = { transferId: string; kind: 'accept' | 'reject' }

function QueueBody({ role }: { role: QueueRole }) {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<BusyAction | null>(null)

  const applyEntries = useCallback(
    (entries: FronterQueueEntry[] | CloserQueueEntry[]) => {
      if (role === 'fronter') {
        setLoad({ status: 'ready', role: 'fronter', entries: entries as FronterQueueEntry[] })
      } else {
        setLoad({ status: 'ready', role: 'closer', entries: entries as CloserQueueEntry[] })
      }
    },
    [role]
  )

  const refetchQueue = useCallback(async () => {
    if (role === 'fronter') {
      const entries = await withSession((token) => listQueue(token, 'fronter', { bust: true }))
      applyEntries(entries)
      return
    }
    const entries = await withSession((token) => listQueue(token, 'closer', { bust: true }))
    applyEntries(entries)
  }, [applyEntries, role])

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      try {
        await waitForMocking()
        if (role === 'fronter') {
          const entries = await withSession((token) => listQueue(token, 'fronter'))
          if (!cancelled) applyEntries(entries)
        } else {
          const entries = await withSession((token) => listQueue(token, 'closer'))
          if (!cancelled) applyEntries(entries)
        }
      } catch {
        if (!cancelled) setLoad({ status: 'error', message: 'Unable to load the queue right now.' })
      }
    }

    void loadInitial()
    return () => {
      cancelled = true
    }
  }, [applyEntries, role])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const pollMs = role === 'closer' ? CLOSER_POLL_MS : FRONTER_POLL_MS
    const id = setInterval(() => {
      void refetchQueue().catch(() => {
        // A failed refresh keeps the last good snapshot on screen.
      })
    }, pollMs)

    return () => clearInterval(id)
  }, [refetchQueue, role])

  const handleAccept = useCallback(
    async (entry: CloserQueueEntry) => {
      if (currentUser.status !== 'ready') return
      setBusy({ transferId: entry.id, kind: 'accept' })
      setNotice(null)
      setActionError(null)
      try {
        await withSession((token) =>
          acceptTransfer(entry.id, { closer_user_id: currentUser.user.id }, token)
        )
        await refetchQueue()
        router.push(closerWorkspaceHref(entry.interaction_id, entry.id))
      } catch (err) {
        if (err instanceof AuthError && err.code === 'transfer.not_answerable') {
          setNotice('Already taken')
          await refetchQueue().catch(() => {})
        } else {
          setActionError(err instanceof Error ? err.message : 'Unable to accept this transfer.')
        }
      } finally {
        setBusy(null)
      }
    },
    [currentUser, refetchQueue, router]
  )

  const handleReject = useCallback(
    async (entry: CloserQueueEntry) => {
      if (currentUser.status !== 'ready') return
      setBusy({ transferId: entry.id, kind: 'reject' })
      setNotice(null)
      setActionError(null)
      try {
        await withSession((token) =>
          rejectTransfer(entry.id, { closer_user_id: currentUser.user.id }, token)
        )
        await refetchQueue()
      } catch (err) {
        if (err instanceof AuthError && err.code === 'transfer.not_answerable') {
          setNotice('Already taken')
          await refetchQueue().catch(() => {})
        } else {
          setActionError(err instanceof Error ? err.message : 'Unable to reject this transfer.')
        }
      } finally {
        setBusy(null)
      }
    },
    [currentUser, refetchQueue]
  )

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

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <MuiAlert severity="warning" role="status" onClose={() => setNotice(null)} sx={{ mb: 0 }}>
          {notice}
        </MuiAlert>
      )}
      {actionError && <Alert>{actionError}</Alert>}
      <QueueTable
        role="closer"
        entries={load.entries}
        now={now}
        busyTransferId={busy?.transferId ?? null}
        busyKind={busy?.kind ?? null}
        onAccept={(entry) => {
          void handleAccept(entry)
        }}
        onReject={(entry) => {
          void handleReject(entry)
        }}
      />
    </div>
  )
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
