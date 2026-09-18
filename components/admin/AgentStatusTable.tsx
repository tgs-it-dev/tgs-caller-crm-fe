'use client'

import { useState } from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import type { Role } from '@/lib/auth'
import { formatTime } from '@/lib/format'
import type { AgentLiveStatus, AgentStatus } from '@/lib/liveStatus'
import { tokens } from '@/lib/theme'

const PAGE_SIZE = 10

const STATUS: Record<
  AgentStatus,
  { label: string; tone: 'signal' | 'caution' | 'done' | 'neutral'; onCall: boolean }
> = {
  on_call: { label: 'On Call', tone: 'signal', onCall: true },
  // Still on the phone with the customer, working the form.
  in_qualification: { label: 'In Qualification', tone: 'caution', onCall: true },
  available: { label: 'Available', tone: 'done', onCall: false },
  offline: { label: 'Offline', tone: 'neutral', onCall: false },
}

const ROLE_LABEL: Record<Role, string> = {
  fronter: 'Fronter',
  closer: 'Closer',
  administrator: 'Administrator',
}

export function AgentStatusTable({
  agents,
  timeZone,
}: {
  agents: AgentLiveStatus[]
  /** The business time zone, so these times read in the same day as the counts above. */
  timeZone: string
}) {
  const [page, setPage] = useState(1)
  // The design dashes this card while a call is going on, and only then.
  const live = agents.some((agent) => STATUS[agent.status].onCall)

  const totalPages = Math.max(1, Math.ceil(agents.length / PAGE_SIZE))
  // A push can shrink the list underneath us, so never render past the end.
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * PAGE_SIZE
  const visible = agents.slice(offset, offset + PAGE_SIZE)

  return (
    <div
      className={`rounded-xl border-hairline bg-white p-5 ${
        live
          ? // An outline rather than a thicker border: it takes no room, so switching
            // it on or off never moves the table, whatever the browser.
            'border-transparent outline-dashed outline-2 -outline-offset-2 outline-relay-blue'
          : 'border-slate'
      }`}
    >
      <h2 className="mb-5 border-b-hairline border-slate pb-4 text-lg font-medium leading-[120%] text-ink">
        Agent Status
      </h2>

      {agents.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate">No fronters or closers yet.</p>
      ) : (
        <>
          <Table
            aria-label="Agent status"
            sx={{
              '& tbody td': {
                paddingTop: '16px',
                paddingBottom: '16px',
                color: tokens.black,
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell scope="col">Agent</TableCell>
                <TableCell scope="col">Role</TableCell>
                <TableCell scope="col">Status</TableCell>
                <TableCell scope="col">On Call Since</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((agent) => {
                const status = STATUS[agent.status]
                return (
                  <TableRow key={agent.user_id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <span className="h-8 w-8 flex-shrink-0 rounded-full bg-slate/20" aria-hidden />
                        {agent.name}
                      </span>
                    </TableCell>
                    <TableCell>{ROLE_LABEL[agent.role]}</TableCell>
                    <TableCell>
                      <Badge tone={status.tone} dot={status.tone !== 'neutral'}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{status.onCall ? formatTime(agent.since, timeZone) : '-'}</TableCell>
                  </TableRow>
                )
              })}
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
