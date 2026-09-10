'use client'

import { useState } from 'react'
import Link from 'next/link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { formatPhone, formatWaitTime, formatWaitTimeLabel } from '@/lib/format'
import type { QueueEntry, QueueStatus } from '@/lib/queue'

const PAGE_SIZE = 5

const STATUS: Record<QueueStatus, { label: string; tone: 'signal' | 'caution' }> = {
  ringing: { label: 'Ringing', tone: 'signal' },
  waiting: { label: 'Waiting', tone: 'caution' },
}

export function QueueTable({ entries, now }: { entries: QueueEntry[]; now: number }) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  // Polling can shrink the queue underneath us, so never render past the end.
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * PAGE_SIZE
  const visible = entries.slice(offset, offset + PAGE_SIZE)

  return (
    // Dashed outline marks the card as live-updating. Figma specifies a 10/10
    // dash rhythm, which CSS can't express — Chrome draws ~6/4 at this width.
    <div className="rounded-xl border-2 border-dashed border-relay-blue bg-white p-5">
      <h2 className="mb-5 border-b-hairline border-slate pb-4 text-lg font-medium leading-[120%] text-ink">
        Waiting / Ringing
      </h2>

      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate">No calls waiting right now.</p>
      ) : (
        <>
          <Table aria-label="Calls waiting or ringing">
            <TableHead>
              <TableRow>
                <TableCell scope="col">Lead</TableCell>
                <TableCell scope="col">Campaign</TableCell>
                <TableCell scope="col">Wait Time</TableCell>
                <TableCell scope="col">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Link
                      href={`/fronter/workspace/${entry.id}`}
                      className="font-medium hover:text-navy hover:underline"
                    >
                      {entry.lead_name}
                    </Link>
                    <span className="mt-1 block text-xs text-slate">
                      {formatPhone(entry.lead_phone)}
                    </span>
                  </TableCell>
                  <TableCell>{entry.campaign_name}</TableCell>
                  <TableCell aria-label={formatWaitTimeLabel(entry.queued_at, now)}>
                    {formatWaitTime(entry.queued_at, now)}
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS[entry.status].tone} dot={entry.status === 'ringing'}>
                      {STATUS[entry.status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex h-[37px] items-center rounded-md bg-table-strip px-6">
            <Pagination
              className="w-full"
              page={currentPage}
              totalPages={totalPages}
              rangeStart={offset + 1}
              rangeEnd={offset + visible.length}
              onPrevious={() => setPage(Math.max(1, currentPage - 1))}
              onNext={() => setPage(Math.min(totalPages, currentPage + 1))}
            />
          </div>
        </>
      )}
    </div>
  )
}
