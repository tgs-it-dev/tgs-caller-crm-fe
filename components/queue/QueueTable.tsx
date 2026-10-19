'use client'

import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { formatPhone, formatWaitTime, formatWaitTimeLabel, formatWaitTimeMinutesSeconds } from '@/lib/format'
import { closerWorkspaceHref } from '@/lib/closer'
import { fronterWorkspaceHref, type CloserQueueEntry, type CloserQueueStatus, type FronterQueueEntry, type FronterQueueStatus } from '@/lib/queue'
import { isPendingTransfer } from '@/lib/transfers'

const FRONTER_STATUS: Record<
  FronterQueueStatus,
  { label: string; tone: 'signal' | 'caution' | 'accepted' }
> = {
  ringing: { label: 'Ringing', tone: 'signal' },
  waiting: { label: 'Waiting', tone: 'caution' },
  accepted: { label: 'On Call', tone: 'accepted' },
}

const CLOSER_STATUS: Record<
  CloserQueueStatus,
  { label: string; tone: 'signal' | 'caution' | 'accepted' }
> = {
  offered: { label: 'Offered', tone: 'signal' },
  initiated: { label: 'Initiated', tone: 'caution' },
  accepted: { label: 'On Call', tone: 'accepted' },
}

/** Unclaimed until accept stamps fronter_user_id (status alone can lag a poll). */
function isUnclaimedFronter(entry: FronterQueueEntry): boolean {
  return entry.status !== 'accepted' && entry.fronter_user_id == null
}

function fronterActionCell(
  entry: FronterQueueEntry,
  opts: {
    busyInteractionId: string | null
    onAccept: (entry: FronterQueueEntry) => void
  }
) {
  if (!isUnclaimedFronter(entry)) {
    return (
      <div className="whitespace-nowrap">
        <MuiButton
          component={Link}
          href={fronterWorkspaceHref(entry.id)}
          size="small"
          variant="outlined"
          color="primary"
        >
          Open call
        </MuiButton>
      </div>
    )
  }

  const rowBusy = opts.busyInteractionId === entry.id
  return (
    <div className="whitespace-nowrap">
      <MuiButton
        size="small"
        variant="contained"
        color="primary"
        disabled={opts.busyInteractionId !== null}
        onClick={() => opts.onAccept(entry)}
        startIcon={
          rowBusy ? undefined : <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        }
        aria-label="Accept"
      >
        {rowBusy ? 'Accepting…' : 'Accept'}
      </MuiButton>
    </div>
  )
}

function fronterColumns(
  now: number,
  opts: {
    busyInteractionId: string | null
    onAccept: (entry: FronterQueueEntry) => void
  }
): DataColumn<FronterQueueEntry>[] {
  return [
    {
      id: 'lead',
      header: 'Lead',
      render: (entry) => (
        <>
          {isUnclaimedFronter(entry) ? (
            <span className="font-medium">{entry.lead_name}</span>
          ) : (
            <Link
              href={fronterWorkspaceHref(entry.id)}
              className="font-medium hover:text-navy hover:underline"
            >
              {entry.lead_name}
            </Link>
          )}
          <span className="mt-1 block text-xs text-slate">{formatPhone(entry.lead_phone)}</span>
        </>
      ),
    },
    {
      id: 'campaign',
      header: 'Campaign',
      render: (entry) => entry.campaign_name,
    },
    {
      id: 'wait',
      header: 'Wait Time',
      render: (entry) => (
        <span aria-label={formatWaitTimeLabel(entry.queued_at, now)}>
          {formatWaitTimeMinutesSeconds(entry.queued_at, now)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (entry) => {
        const status = FRONTER_STATUS[entry.status] ?? FRONTER_STATUS.waiting
        return (
          <Badge
            tone={status.tone}
            dot={entry.status === 'ringing' || entry.status === 'accepted'}
          >
            {status.label}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      render: (entry) => fronterActionCell(entry, opts),
    },
  ]
}

function closerColumns(
  now: number,
  opts: {
    busyTransferId: string | null
    onAccept: (entry: CloserQueueEntry) => void
  }
): DataColumn<CloserQueueEntry>[] {
  return [
    {
      id: 'lead',
      header: 'Lead',
      render: (entry) => (
        <>
          {entry.status === 'accepted' ? (
            <Link
              href={closerWorkspaceHref(entry.interaction_id, entry.id)}
              className="font-medium hover:text-navy hover:underline"
            >
              {entry.lead_name}
            </Link>
          ) : (
            <span className="font-medium">{entry.lead_name}</span>
          )}
          <span className="mt-1 block text-xs text-slate">{formatPhone(entry.lead_phone)}</span>
        </>
      ),
    },
    {
      id: 'transfer',
      header: 'Transfer',
      render: (entry) => (
        <span className="font-mono text-xs text-slate">{entry.id.slice(0, 8)}…</span>
      ),
    },
    {
      id: 'wait',
      header: 'Wait Time',
      render: (entry) => (
        <span aria-label={formatWaitTimeLabel(entry.queued_at, now)}>
          {formatWaitTime(entry.queued_at, now)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (entry) => (
        <Badge
          tone={CLOSER_STATUS[entry.status].tone}
          dot={entry.status === 'offered' || entry.status === 'accepted'}
        >
          {CLOSER_STATUS[entry.status].label}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      render: (entry) => {
        if (entry.status === 'accepted') {
          return (
            <div className="whitespace-nowrap">
              <MuiButton
                component={Link}
                href={closerWorkspaceHref(entry.interaction_id, entry.id)}
                size="small"
                variant="outlined"
                color="primary"
              >
                Open call
              </MuiButton>
            </div>
          )
        }

        if (!isPendingTransfer(entry.status)) return null

        const rowBusy = opts.busyTransferId === entry.id
        return (
          <div className="whitespace-nowrap">
            <MuiButton
              size="small"
              variant="contained"
              color="primary"
              disabled={opts.busyTransferId !== null}
              onClick={() => opts.onAccept(entry)}
              startIcon={
                rowBusy ? undefined : (
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                )
              }
              aria-label="Accept"
            >
              {rowBusy ? 'Accepting…' : 'Accept'}
            </MuiButton>
          </div>
        )
      },
    },
  ]
}

type QueueTableProps =
  | {
      role: 'fronter'
      entries: FronterQueueEntry[]
      now: number
      busyInteractionId: string | null
      onAccept: (entry: FronterQueueEntry) => void
    }
  | {
      role: 'closer'
      entries: CloserQueueEntry[]
      now: number
      busyTransferId: string | null
      onAccept: (entry: CloserQueueEntry) => void
    }

/** Live queue table shared by fronter and closer desks. */
export function QueueTable(props: QueueTableProps) {
  if (props.role === 'closer') {
    return (
      <DataTable
        title="Waiting / Offered"
        ariaLabel="Transfers waiting, offered, or on call"
        rows={props.entries}
        columns={closerColumns(props.now, {
          busyTransferId: props.busyTransferId,
          onAccept: props.onAccept,
        })}
        getRowId={(entry) => entry.id}
        emptyMessage="No transfers waiting right now."
        variant="live"
        minWidth="max-content"
      />
    )
  }

  return (
    <DataTable
      title="Waiting / Ringing"
      ariaLabel="Calls waiting, ringing, or on call"
      rows={props.entries}
      columns={fronterColumns(props.now, {
        busyInteractionId: props.busyInteractionId,
        onAccept: props.onAccept,
      })}
      getRowId={(entry) => entry.id}
      emptyMessage="No calls waiting right now."
      variant="live"
      minWidth="max-content"
    />
  )
}
