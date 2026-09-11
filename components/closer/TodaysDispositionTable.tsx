'use client'

import { useState } from 'react'
import Link from 'next/link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { Pagination } from '@/components/ui/Pagination'
import type { TodaysDispositionRow } from '@/lib/closer'
import { tokens } from '@/lib/theme'

const PAGE_SIZE = 5

export function TodaysDispositionTable({ rows }: { rows: TodaysDispositionRow[] }) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * PAGE_SIZE
  const visible = rows.slice(offset, offset + PAGE_SIZE)

  return (
    <div className="rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="mb-5 border-b-hairline border-light-grey pb-4 text-lg font-medium leading-[120%] text-ink">
        Today&apos;s Disposition
      </h2>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate">No accepted transfers yet today.</p>
      ) : (
        <>
          <Table
            aria-label="Today's dispositions"
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
                <TableCell scope="col">From</TableCell>
                <TableCell scope="col">Interaction ID</TableCell>
                <TableCell scope="col">Accepted</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.transfer_id}>
                  <TableCell>
                    <Link
                      href={`/closer/workspace/${row.interaction_id}`}
                      className="font-medium text-navy underline hover:text-black"
                    >
                      {row.from_name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-black">[uuid]</TableCell>
                  <TableCell>{row.accepted_at}</TableCell>
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
