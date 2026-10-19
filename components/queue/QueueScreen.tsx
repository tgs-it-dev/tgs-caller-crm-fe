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
  acceptFronterQueue,
  fronterWorkspaceHref,
  listQueue,
  type CloserQueueEntry,
  type FronterQueueEntry,
  type QueueRole,
} from '@/lib/queue'
import { withSession } from '@/lib/session'
import { acceptTransfer } from '@/lib/transfers'

/** Wait times tick every second; the list itself is refreshed less often. */
const TICK_MS = 1000
/**
 * Both desks need multi-browser sync for exclusivity — fronter accept hides
 * the row from other fronters the same way closer accept does for transfers.
 */
const POLL_MS = 3000

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; role: 'fronter'; entries: FronterQueueEntry[] }
  | { status: 'ready'; role: 'closer'; entries: CloserQueueEntry[] }

function QueueBody({ role }: { role: QueueRole }) {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    const id = setInterval(() => {
      void refetchQueue().catch(() => {
        // A failed refresh keeps the last good snapshot on screen.
      })
    }, POLL_MS)

    return () => clearInterval(id)
  }, [refetchQueue])

  const handleAcceptFronter = useCallback(
    async (entry: FronterQueueEntry) => {
      if (currentUser.status !== 'ready') return
      setBusyId(entry.id)
      setNotice(null)
      setActionError(null)
      try {
        await withSession((token) =>
          acceptFronterQueue(entry.id, { fronter_user_id: currentUser.user.id }, token)
        )
        await refetchQueue()
        router.push(fronterWorkspaceHref(entry.id))
      } catch (err) {
        if (err instanceof AuthError && err.code === 'queue.not_answerable') {
          setNotice('Already taken')
          await refetchQueue().catch(() => {})
        } else {
          setActionError(err instanceof Error ? err.message : 'Unable to accept this lead.')
        }
      } finally {
        setBusyId(null)
      }
    },
    [currentUser, refetchQueue, router]
  )

  const handleAcceptCloser = useCallback(
    async (entry: CloserQueueEntry) => {
      if (currentUser.status !== 'ready') return
      setBusyId(entry.id)
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
        setBusyId(null)
      }
    },
    [currentUser, refetchQueue, router]
  )

  if (load.status === 'loading') {
    return (
      <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
        Loading the queue…
      </p>
    )
  }

  if (load.status === 'error') return <Alert>{load.message}</Alert>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {notice && (
        <MuiAlert severity="warning" role="status" onClose={() => setNotice(null)} sx={{ mb: 0 }}>
          {notice}
        </MuiAlert>
      )}
      {actionError && <Alert>{actionError}</Alert>}
      {load.role === 'fronter' ? (
        <QueueTable
          role="fronter"
          entries={load.entries}
          now={now}
          busyInteractionId={busyId}
          onAccept={(entry) => {
            void handleAcceptFronter(entry)
          }}
        />
      ) : (
        <QueueTable
          role="closer"
          entries={load.entries}
          now={now}
          busyTransferId={busyId}
          onAccept={(entry) => {
            void handleAcceptCloser(entry)
          }}
        />
      )}
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
