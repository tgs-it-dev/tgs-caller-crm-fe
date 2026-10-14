'use client'

import { Fragment, useState, type ReactNode } from 'react'
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

/**
 * Paging the caller does against the server: `rows` is already one page, and
 * the footer moves `offset`. Without it the table pages `rows` in the browser.
 */
export type ServerPaging = {
  total: number
  limit: number
  offset: number
  onOffsetChange: (offset: number) => void
}

type DataTableProps<T> = {
  /** On the card, for a control elsewhere that points at this list. */
  id?: string
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
  paging?: ServerPaging
  /**
   * A full-width row beneath the open one. The caller owns both the control
   * that opens it and which row is open, so the trigger can say what it does.
   */
  expandedRowId?: string | null
  renderExpanded?: (row: T) => ReactNode
  /**
   * A floor for the table's width, e.g. `'max-content'` where cells must not
   * wrap. Below it the card scrolls sideways instead of squeezing columns
   * until their contents overlap.
   */
  minWidth?: number | string
  /**
   * Skip the titled card chrome — for nesting inside an accordion (or similar)
   * that already owns the heading.
   */
  embedded?: boolean
}

/**
 * Shared data table: titled card, MUI grid, client pagination.
 * Feature modules only supply columns + row data — not a second table shell.
 */
export function DataTable<T>({
  id,
  title,
  ariaLabel,
  rows,
  columns,
  getRowId,
  emptyMessage,
  actions,
  variant = 'solid',
  pageSize = DEFAULT_PAGE_SIZE,
  paging,
  expandedRowId = null,
  renderExpanded,
  minWidth,
  embedded = false,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)

  const localTotalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  // Live lists can shrink under us; never render past the last page.
  const localPage = Math.min(page, localTotalPages)
  const localOffset = (localPage - 1) * pageSize

  const totalPages = paging ? Math.max(1, Math.ceil(paging.total / paging.limit)) : localTotalPages
  const currentPage = paging ? Math.floor(paging.offset / paging.limit) + 1 : localPage
  const offset = paging ? paging.offset : localOffset
  const visible = paging ? rows : rows.slice(localOffset, localOffset + pageSize)

  const goTo = (nextOffset: number) => {
    if (paging) paging.onOffsetChange(nextOffset)
    else setPage(Math.floor(nextOffset / pageSize) + 1)
  }

  const shell =
    variant === 'live'
      ? // Figma Queue: dashed 10/10 rhythm — CSS approximates (~6/4 in Chrome).
        'rounded-xl border-2 border-dashed border-relay-blue bg-white p-5'
      : 'rounded-xl border-hairline border-slate bg-white p-6'

  const titleRule = variant === 'live' ? 'border-slate' : 'border-light-grey'

  const body =
    rows.length === 0 ? (
      <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-slate">
        {emptyMessage}
      </p>
    ) : (
      <>
        {/* Natural height only — do not flex-1 this. overflow-x:auto makes
            overflow-y compute to auto; a bounded height here nested a second
            vertical scroller inside the desk pane ("scroll, then scroll again"
            into empty space). Leftover card height sits above pagination. */}
        <div className="overflow-x-auto">
          <Table
            aria-label={ariaLabel}
            sx={{
              // MUI lays tables out fixed, which divides the width it is given
              // and ignores what is in the cells. A table asking for room has
              // to be measured by its content for `minWidth` to mean anything.
              ...(minWidth !== undefined && { minWidth, tableLayout: 'auto' }),
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
              {visible.map((row) => {
                const rowId = getRowId(row)
                const expanded = renderExpanded && rowId === expandedRowId

                return (
                  <Fragment key={rowId}>
                    <TableRow>
                      {columns.map((col) => (
                        <TableCell key={col.id} align={col.align}>
                          {col.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={columns.length}>
                          {/* `w-0 min-w-full` keeps this panel out of the
                              table's intrinsic width: a paragraph in here
                              would otherwise widen every column under
                              `minWidth: max-content` and push the last one
                              off the card. It still renders full width. */}
                          <div className="w-0 min-w-full">{renderExpanded(row)}</div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-auto flex h-[37px] shrink-0 items-center rounded-md bg-table-strip px-6">
          <Pagination
            className="w-full"
            page={currentPage}
            totalPages={totalPages}
            rangeStart={offset + 1}
            rangeEnd={offset + visible.length}
            onPrevious={() => goTo(Math.max(0, offset - (paging?.limit ?? pageSize)))}
            onNext={() => goTo(offset + (paging?.limit ?? pageSize))}
          />
        </div>
      </>
    )

  if (embedded) {
    return (
      <div id={id} className="flex min-w-0 flex-1 flex-col">
        {body}
      </div>
    )
  }

  // flex-1 fills spare desk height; no min-h-0 so row content can still grow
  // the page and scroll in the desk pane alone.
  return (
    <div id={id} className={`${shell} flex flex-1 flex-col`}>
      <div
        className={`mb-5 flex shrink-0 items-center justify-between gap-4 border-b-hairline ${titleRule} pb-4`}
      >
        <h2 className="text-lg font-medium leading-[120%] text-ink">{title}</h2>
        {actions}
      </div>
      {body}
    </div>
  )
}
