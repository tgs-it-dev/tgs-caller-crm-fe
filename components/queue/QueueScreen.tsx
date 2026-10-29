'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MuiAlert from '@mui/material/Alert'
import MuiButton from '@mui/material/Button'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { QueueTable } from '@/components/queue/QueueTable'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
// import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { closerWorkspaceHref } from '@/lib/closer'
import { formatDateTime, formatPhone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  listCloserCallbacks,
  listQueue,
  type CloserCallbackEntry,
  type CloserQueueEntry,
} from '@/lib/queue'
import { withSession } from '@/lib/session'
import { acceptTransfer } from '@/lib/transfers'

/** Wait times tick every second; the list itself is refreshed less often. */
const TICK_MS = 1000
/** Multi-browser sync for transfer exclusivity. */
const POLL_MS = 3000
/** Callbacks change rarely, so they refresh far less often than the queue. */
const CALLBACKS_POLL_MS = 30_000

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: CloserQueueEntry[] }

type CallbacksLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; entries: CloserCallbackEntry[] }

const CALLBACK_COLUMNS: DataColumn<CloserCallbackEntry>[] = [
  {
    id: 'lead',
    header: 'Lead',
    render: (entry) => (
      <>
        <span className="font-medium text-ink">{entry.lead_name}</span>
        <span className="mt-1 block text-xs text-slate">{formatPhone(entry.lead_phone)}</span>
      </>
    ),
  },
  { id: 'team', header: 'Team', render: (entry) => entry.team_name },
  {
    id: 'scheduled',
    header: 'Callback set',
    render: (entry) => (
      <span className="whitespace-nowrap">{formatDateTime(entry.scheduled_at)}</span>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    render: (entry) => (
      <div className="whitespace-nowrap">
        <MuiButton
          component={Link}
          href={closerWorkspaceHref(entry.interaction_id, entry.transfer_id)}
          size="small"
          variant="outlined"
          color="primary"
          aria-label={`Open ${entry.lead_name}`}
        >
          Open
        </MuiButton>
      </div>
    ),
  },
]

/** Loads on its own, so a queue error never hides the callbacks, and the reverse. */
function CallbacksSection() {
  const [load, setLoad] = useState<CallbacksLoad>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      try {
        await waitForMocking()
        const entries = await withSession((token) => listCloserCallbacks(token))
        if (!cancelled) setLoad({ status: 'ready', entries })
      } catch {
        // A failed refresh keeps the last good list on screen.
        if (!cancelled) {
          setLoad((current) => (current.status === 'ready' ? current : { status: 'error' }))
        }
      }
    }

    void refresh()
    const id = setInterval(() => void refresh(), CALLBACKS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (load.status === 'error') return <Alert>Unable to load your callbacks right now.</Alert>

  return (
    <DataTable
      title="Callbacks"
      ariaLabel="Calls you set as a callback"
      rows={load.status === 'ready' ? load.entries : []}
      columns={CALLBACK_COLUMNS}
      getRowId={(entry) => entry.interaction_id}
      emptyMessage={load.status === 'loading' ? 'Loading your callbacks…' : 'No callbacks scheduled.'}
      minWidth="max-content"
    />
  )
}

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
      <div className="flex flex-col gap-6">
        <QueueBody />
        <CallbacksSection />
      </div>
    </PageShell>
  )
}
