'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MuiAlert from '@mui/material/Alert'
import MuiButton from '@mui/material/Button'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { PageShell } from '@/components/ui/PageShell'
import { Segmented } from '@/components/ui/Segmented'
import { AuthError, isSuperAdmin } from '@/lib/auth'
import {
  CALLBACK_STATUS_LABEL,
  CALLBACK_STATUS_TONE,
  decideCallbackRequest,
  listCallbackRequests,
  type CallbackRequestItem,
  type CallbackRequestList,
  type CallbackRequestStatus,
} from '@/lib/callbacks'
import { formatDateTime } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

const PAGE_SIZE = 20

type Filter = CallbackRequestStatus | 'all'

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const TITLES: Record<Filter, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  all: 'All requests',
}

const EMPTY: Record<Filter, string> = {
  pending: 'No callbacks are waiting for approval.',
  approved: 'No approved callbacks yet.',
  rejected: 'No rejected callbacks.',
  all: 'No callback requests yet.',
}

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: CallbackRequestList }

type Deciding = { item: CallbackRequestItem; answer: 'approved' | 'rejected' }

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return err instanceof AuthError ? err.message : fallback
}

function Decision({ item }: { item: CallbackRequestItem }) {
  if (!item.decided_at) return <span className="text-slate">-</span>
  return (
    <span className="whitespace-nowrap">
      {[item.decided_by_name, formatDateTime(item.decided_at)].filter(Boolean).join(', ')}
    </span>
  )
}

function DecisionDialog({
  deciding,
  onClose,
  onDecided,
}: {
  deciding: Deciding
  onClose: () => void
  onDecided: (item: CallbackRequestItem) => void
}) {
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { item, answer } = deciding
  const rejecting = answer === 'rejected'
  const closer = item.closer_name ?? 'The closer'

  async function submit() {
    setSaving(true)
    setProblem(null)
    try {
      await waitForMocking()
      onDecided(await withSession((token) => decideCallbackRequest(item.id, answer, token)))
    } catch (err) {
      setProblem(messageFor(err, 'Could not save. Try again.'))
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title={rejecting ? 'Reject the callback' : 'Approve the callback'}
      onClose={onClose}
      busy={saving}
      maxWidth="sm"
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            isLoading={saving}
            loadingText="Saving…"
          >
            {rejecting ? 'Reject' : 'Approve'}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-[150%] text-body-text">
        {rejecting
          ? `${item.lead_name}'s call stays closed to ${closer}, who sees it as rejected.`
          : `${closer} can work ${item.lead_name}'s call again, until they record its next outcome.`}
      </p>
      {problem && (
        <p role="alert" className="mt-2 text-sm leading-[150%] text-status-red">
          {problem}
        </p>
      )}
    </Dialog>
  )
}

/**
 * Callback requests: a Super Admin decides, and a Team Admin sees their teams'. A
 * closer follows theirs on the Queue's Callbacks.
 */
export function CallbackRequestsScreen() {
  const { user } = useCurrentUser()
  const canDecide = Boolean(user && isSuperAdmin(user.roles))
  const [filter, setFilter] = useState<Filter>('pending')
  const [offset, setOffset] = useState(0)
  const [reload, setReload] = useState(0)
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [deciding, setDeciding] = useState<Deciding | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const status = filter === 'all' ? null : filter
    waitForMocking()
      .then(() =>
        withSession((token) => listCallbackRequests({ status, limit: PAGE_SIZE, offset }, token))
      )
      .then((page) => {
        if (!cancelled) setLoad({ status: 'ready', page })
      })
      .catch((err) => {
        if (!cancelled) {
          setLoad({ status: 'error', message: messageFor(err, 'Could not load the requests.') })
        }
      })
    return () => {
      cancelled = true
    }
  }, [filter, offset, reload])

  function choose(next: Filter) {
    // The tab already shown: nothing would load again, so the list must not clear.
    if (next === filter) return
    setFilter(next)
    setOffset(0)
    setLoad({ status: 'loading' })
  }

  const columns: DataColumn<CallbackRequestItem>[] = [
    {
      id: 'customer',
      header: 'Customer',
      render: (item) => <span className="font-medium text-ink">{item.lead_name}</span>,
    },
    { id: 'team', header: 'Team', render: (item) => item.team_name },
    { id: 'closer', header: 'Closer', render: (item) => item.closer_name ?? '-' },
    {
      id: 'requested',
      header: 'Requested',
      render: (item) => <span className="whitespace-nowrap">{formatDateTime(item.requested_at)}</span>,
    },
    // One filter shows one status, so the column earns its place only under All.
    ...(filter === 'all'
      ? [
          {
            id: 'status',
            header: 'Status',
            render: (item: CallbackRequestItem) => (
              <Badge tone={CALLBACK_STATUS_TONE[item.status]}>
                {CALLBACK_STATUS_LABEL[item.status]}
              </Badge>
            ),
          },
        ]
      : []),
    ...(filter === 'pending'
      ? []
      : [
          {
            id: 'decided',
            header: 'Decided',
            render: (item: CallbackRequestItem) => <Decision item={item} />,
          },
        ]),
    // A Super Admin opens the lead's full view from any row, to look before deciding.
    ...(canDecide
      ? [
          {
            id: 'actions',
            header: '',
            align: 'right' as const,
            render: (item: CallbackRequestItem) => (
              <div className="flex justify-end gap-2 whitespace-nowrap">
                <MuiButton
                  component={Link}
                  href={`/admin/reports/lead/?id=${encodeURIComponent(item.lead_id)}&from=callbacks`}
                  size="small"
                  variant="outlined"
                >
                  Open<span className="sr-only"> {item.lead_name}</span>
                </MuiButton>
                {item.status === 'pending' && (
                  <>
                    <MuiButton
                      size="small"
                      variant="contained"
                      color="primary"
                      disableElevation
                      onClick={() => setDeciding({ item, answer: 'approved' })}
                    >
                      Approve<span className="sr-only"> {item.lead_name}</span>
                    </MuiButton>
                    <MuiButton
                      size="small"
                      variant="text"
                      color="error"
                      onClick={() => setDeciding({ item, answer: 'rejected' })}
                    >
                      Reject<span className="sr-only"> {item.lead_name}</span>
                    </MuiButton>
                  </>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  const page = load.status === 'ready' ? load.page : null
  const intro = canDecide
    ? 'Approving lets the closer work the call again, until they record its next outcome.'
    : "Your team's closers' callbacks. A Super Admin approves or rejects them."

  return (
    <PageShell title="Callback requests">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {notice && (
          <MuiAlert severity="success" onClose={() => setNotice(null)}>
            {notice}
          </MuiAlert>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}
        <DataTable
          title={TITLES[filter]}
          ariaLabel="Callback requests"
          toolbar={
            <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Segmented label="Show requests" options={FILTERS} value={filter} onChange={choose} />
              <p className="text-sm leading-[150%] text-slate">{intro}</p>
            </div>
          }
          rows={page?.items ?? []}
          columns={columns}
          getRowId={(item) => item.id}
          emptyMessage={load.status === 'loading' ? 'Loading…' : EMPTY[filter]}
          paginate={false}
          paging={
            page
              ? {
                  total: page.total,
                  limit: page.limit,
                  offset: page.offset,
                  onOffsetChange: setOffset,
                }
              : undefined
          }
          minWidth="max-content"
        />
      </div>

      {deciding && (
        <DecisionDialog
          deciding={deciding}
          onClose={() => setDeciding(null)}
          onDecided={(item) => {
            setDeciding(null)
            setNotice(
              item.status === 'approved'
                ? `Approved ${item.lead_name}'s callback. ${item.closer_name ?? 'The closer'} can open it from their Callbacks.`
                : `Rejected ${item.lead_name}'s callback. The call stays closed.`
            )
            setReload((n) => n + 1)
          }}
        />
      )}
    </PageShell>
  )
}
