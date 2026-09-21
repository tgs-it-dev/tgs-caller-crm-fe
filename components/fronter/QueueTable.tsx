'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { formatPhone, formatWaitTime, formatWaitTimeLabel } from '@/lib/format'
import type { QueueEntry, QueueStatus } from '@/lib/queue'

const STATUS: Record<QueueStatus, { label: string; tone: 'signal' | 'caution' }> = {
  ringing: { label: 'Ringing', tone: 'signal' },
  waiting: { label: 'Waiting', tone: 'caution' },
}

function queueColumns(now: number): DataColumn<QueueEntry>[] {
  return [
    {
      id: 'lead',
      header: 'Lead',
      render: (entry) => (
        <>
          <Link
            href={`/fronter/workspace/${entry.id}`}
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
        <Badge tone={STATUS[entry.status].tone} dot={entry.status === 'ringing'}>
          {STATUS[entry.status].label}
        </Badge>
      ),
    },
  ]
}

/** Fronter Queue — live variant of `DataTable`. */
export function QueueTable({ entries, now }: { entries: QueueEntry[]; now: number }) {
  return (
    <DataTable
      title="Waiting / Ringing"
      ariaLabel="Calls waiting or ringing"
      rows={entries}
      columns={queueColumns(now)}
      getRowId={(entry) => entry.id}
      emptyMessage="No calls waiting right now."
      variant="live"
    />
  )
}
