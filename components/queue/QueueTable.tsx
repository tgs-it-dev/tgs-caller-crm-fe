'use client'

import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { formatPhone, formatWaitTime, formatWaitTimeLabel } from '@/lib/format'
import { closerWorkspaceHref } from '@/lib/closer'
import { type CloserQueueEntry, type CloserQueueStatus } from '@/lib/queue'
import { isPendingTransfer } from '@/lib/transfers'

const CLOSER_STATUS: Record<
  CloserQueueStatus,
  { label: string; tone: 'signal' | 'caution' | 'accepted' }
> = {
  offered: { label: 'Offered', tone: 'signal' },
  initiated: { label: 'Initiated', tone: 'caution' },
  accepted: { label: 'On Call', tone: 'accepted' },
  own_sale: { label: 'Own Sale', tone: 'accepted' },
}

/** Theirs to work: a transfer they accepted, or a call they started as an Own Sale. */
function openHref(entry: CloserQueueEntry): string | null {
  if (entry.status === 'accepted') return closerWorkspaceHref(entry.interaction_id, entry.id)
  // An Own Sale row has no transfer: its id is the call.
  if (entry.status === 'own_sale') return closerWorkspaceHref(entry.interaction_id)
  return null
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
      render: (entry) => {
        const href = openHref(entry)
        return (
          <>
            {href ? (
              <Link href={href} className="font-medium hover:text-navy hover:underline">
                {entry.lead_name}
              </Link>
            ) : (
              <span className="font-medium">{entry.lead_name}</span>
            )}
            <span className="mt-1 block text-xs text-slate">{formatPhone(entry.lead_phone)}</span>
          </>
        )
      },
    },
    {
      id: 'transfer',
      header: 'Transfer',
      render: (entry) =>
        entry.status === 'own_sale' ? (
          <span className="text-slate">-</span>
        ) : (
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
          dot={entry.status !== 'initiated'}
        >
          {CLOSER_STATUS[entry.status].label}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      render: (entry) => {
        const href = openHref(entry)
        if (href) {
          return (
            <div className="whitespace-nowrap">
              <MuiButton
                component={Link}
                href={href}
                size="small"
                variant="outlined"
                color="primary"
              >
                Open call
              </MuiButton>
            </div>
          )
        }

        if (entry.status === 'own_sale' || !isPendingTransfer(entry.status)) return null

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

/** Live closer transfer queue. */
export function QueueTable({
  role,
  entries,
  now,
  busyTransferId,
  onAccept,
}: {
  role: 'closer'
  entries: CloserQueueEntry[]
  now: number
  busyTransferId: string | null
  onAccept: (entry: CloserQueueEntry) => void
}) {
  void role
  return (
    <DataTable
      title="Waiting / Offered"
      ariaLabel="Transfers waiting, offered, or on call"
      rows={entries}
      columns={closerColumns(now, {
        busyTransferId,
        onAccept,
      })}
      getRowId={(entry) => entry.id}
      emptyMessage="No transfers waiting right now."
      variant="live"
      minWidth="max-content"
    />
  )
}
