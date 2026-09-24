'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { formatPhone, formatWaitTime, formatWaitTimeLabel } from '@/lib/format'
import { closerWorkspaceHref } from '@/lib/closer'
import type {
  CloserQueueEntry,
  CloserQueueStatus,
  FronterQueueEntry,
  FronterQueueStatus,
} from '@/lib/queue'

const FRONTER_STATUS: Record<FronterQueueStatus, { label: string; tone: 'signal' | 'caution' }> = {
  ringing: { label: 'Ringing', tone: 'signal' },
  waiting: { label: 'Waiting', tone: 'caution' },
}

const CLOSER_STATUS: Record<
  CloserQueueStatus,
  { label: string; tone: 'signal' | 'caution' | 'accepted' }
> = {
  offered: { label: 'Offered', tone: 'signal' },
  initiated: { label: 'Initiated', tone: 'caution' },
  accepted: { label: 'On Call', tone: 'accepted' },
}

function fronterColumns(now: number): DataColumn<FronterQueueEntry>[] {
  return [
    {
      id: 'lead',
      header: 'Lead',
      render: (entry) => (
        <>
          <Link
            href={`/fronter/workspace/?id=${encodeURIComponent(entry.id)}`}
            className="font-medium hover:text-navy hover:underline"
          >
            {entry.lead_name}
          </Link>
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
          {formatWaitTime(entry.queued_at, now)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (entry) => (
        <Badge tone={FRONTER_STATUS[entry.status].tone} dot={entry.status === 'ringing'}>
          {FRONTER_STATUS[entry.status].label}
        </Badge>
      ),
    },
  ]
}

function closerColumns(now: number): DataColumn<CloserQueueEntry>[] {
  return [
    {
      id: 'lead',
      header: 'Lead',
      render: (entry) => (
        <Link
          href={closerWorkspaceHref(entry.interaction_id, entry.id)}
          className="font-medium hover:text-navy hover:underline"
        >
          {formatPhone(entry.lead_phone)}
        </Link>
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
  ]
}

type QueueTableProps =
  | { role: 'fronter'; entries: FronterQueueEntry[]; now: number }
  | { role: 'closer'; entries: CloserQueueEntry[]; now: number }

/** Live queue table shared by fronter and closer desks. */
export function QueueTable(props: QueueTableProps) {
  if (props.role === 'closer') {
    return (
      <DataTable
        title="Waiting / Offered"
        ariaLabel="Transfers waiting or offered"
        rows={props.entries}
        columns={closerColumns(props.now)}
        getRowId={(entry) => entry.id}
        emptyMessage="No transfers waiting right now."
        variant="live"
      />
    )
  }

  return (
    <DataTable
      title="Waiting / Ringing"
      ariaLabel="Calls waiting or ringing"
      rows={props.entries}
      columns={fronterColumns(props.now)}
      getRowId={(entry) => entry.id}
      emptyMessage="No calls waiting right now."
      variant="live"
    />
  )
}
