'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MuiAlert from '@mui/material/Alert'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { QueueTable } from '@/components/queue/QueueTable'
import { Alert } from '@/components/ui/Alert'
// import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { closerWorkspaceHref } from '@/lib/closer'
import { waitForMocking } from '@/lib/mockReady'
import { listQueue, type CloserQueueEntry } from '@/lib/queue'
import { withSession } from '@/lib/session'
import { acceptTransfer } from '@/lib/transfers'

/** Wait times tick every second; the list itself is refreshed less often. */
const TICK_MS = 1000
/** Multi-browser sync for transfer exclusivity. */
const POLL_MS = 3000

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: CloserQueueEntry[] }

function QueueBody() {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refetchQueue = useCallback(async () => {
    const entries = await withSession((token) => listQueue(token, 'closer', { bust: true }))
    setLoad({ status: 'ready', entries })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      try {
        await waitForMocking()
        const entries = await withSession((token) => listQueue(token, 'closer'))
        if (!cancelled) setLoad({ status: 'ready', entries })
      } catch {
        if (!cancelled) setLoad({ status: 'error', message: 'Unable to load the queue right now.' })
      }
    }

    void loadInitial()
    return () => {
      cancelled = true
    }
  }, [])

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
      <QueueTable
        role="closer"
        entries={load.entries}
        now={now}
        busyTransferId={busyId}
        onAccept={(entry) => {
          void handleAcceptCloser(entry)
        }}
      />
    </div>
  )
}

/** Closer transfer queue — fronter dialer queue is gone (lead form + callbacks). */
export function QueueScreen({ role }: { role: 'closer' }) {
  void role
  return (
    <PageShell
      title="Queue"
      // actions={
      //   <Badge tone="live" dot>
      //     Live
      //   </Badge>
      // }
    >
      <QueueBody />
    </PageShell>
  )
}
