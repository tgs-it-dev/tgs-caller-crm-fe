'use client'

import { useState, type ReactNode } from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { Pagination } from '@/components/ui/Pagination'
import { tokens } from '@/lib/theme'

const DEFAULT_PAGE_SIZE = 5

export type DataColumn<T> = {
  id: string
  header: ReactNode
  align?: 'left' | 'center' | 'right'
  render: (row: T) => ReactNode
}

type DataTableProps<T> = {
  title: string
  ariaLabel: string
  rows: T[]
  columns: DataColumn<T>[]
  getRowId: (row: T) => string
  emptyMessage: string
  /** Controls for the whole list, sat opposite the title — e.g. "Add User". */
  actions?: ReactNode
  /** `solid` = My Stats / closer cards; `live` = dashed Queue outline. */
  variant?: 'solid' | 'live'
  pageSize?: number
}

/**
 * Shared data table: titled card, MUI grid, client pagination.
 * Feature modules only supply columns + row data — not a second table shell.
 */
export function DataTable<T>({
  title,
  ariaLabel,
  rows,
  columns,
  getRowId,
  emptyMessage,
  actions,
  variant = 'solid',
  pageSize = DEFAULT_PAGE_SIZE,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  // Live lists can shrink under us; never render past the last page.
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * pageSize
  const visible = rows.slice(offset, offset + pageSize)

  const shell =
    variant === 'live'
      ? // Figma Queue: dashed 10/10 rhythm — CSS approximates (~6/4 in Chrome).
        'rounded-xl border-2 border-dashed border-relay-blue bg-white p-5'
      : 'rounded-xl border-hairline border-slate bg-white p-6'

  const titleRule = variant === 'live' ? 'border-slate' : 'border-light-grey'

  return (
    <div className={shell}>
      <div
        className={`mb-5 flex items-center justify-between gap-4 border-b-hairline ${titleRule} pb-4`}
      >
        <h2 className="text-lg font-medium leading-[120%] text-ink">{title}</h2>
        {actions}
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate">{emptyMessage}</p>
      ) : (
        <>
          <Table
            aria-label={ariaLabel}
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
                {columns.map((col) => (
                  <TableCell key={col.id} scope="col" align={col.align}>
                    {col.header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.id} align={col.align}>
                      {col.render(row)}
                    </TableCell>
                  ))}
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
