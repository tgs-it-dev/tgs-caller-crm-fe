'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Select } from '@/components/ui/Select'
import { AuthError } from '@/lib/auth'
import { formatDateTime, formatMoney } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { fetchSales, type DateRange, type SaleItem, type SalesReport } from '@/lib/reporting'
import { withSession } from '@/lib/session'
import { listUsers, type User } from '@/lib/users'

const PAGE_SIZE = 50

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: SalesReport }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403)
    return 'You no longer have access to the sales report.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load sales for this range.'
}

function amount(value: string | null) {
  return value === null ? '-' : formatMoney(value)
}

const COLUMNS: DataColumn<SaleItem>[] = [
  { id: 'lead', header: 'Lead', render: (sale) => sale.lead_name },
  { id: 'team', header: 'Team', render: (sale) => sale.team_name },
  { id: 'closer', header: 'Closer', render: (sale) => sale.closer_name },
  { id: 'sold_at', header: 'Sale date', render: (sale) => formatDateTime(sale.sold_at) },
  { id: 'total', header: 'Total', align: 'right', render: (sale) => amount(sale.total_payment) },
  { id: 'down', header: 'Down', align: 'right', render: (sale) => amount(sale.down_payment) },
  {
    id: 'monthly',
    header: 'Monthly',
    align: 'right',
    render: (sale) => amount(sale.monthly_payment),
  },
]

/**
 * The sales made in the page's dates, newest first, with their totals. The page
 * picks the team and dates; the agent filter is this list's own.
 */
export function SalesSection({ range, teamId }: { range: DateRange; teamId: string }) {
  const [closers, setClosers] = useState<User[]>([])
  const [closerId, setCloserId] = useState('')
  const [offset, setOffset] = useState(0)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  // Adjusting state during render, not in an effect, when the page's filters
  // change: the lint rule this repo enforces forbids the effect form.
  const [asked, setAsked] = useState({ range, teamId })
  if (asked.range !== range || asked.teamId !== teamId) {
    // A closer from another team would leave the list empty for no clear reason.
    if (asked.teamId !== teamId) setCloserId('')
    setOffset(0)
    setAsked({ range, teamId })
    setLoad({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => listUsers(token)))
      .then((list) => {
        if (cancelled) return
        const found = list.items.filter((user) => user.roles.includes('closer'))
        setClosers(found.sort((a, b) => a.name.localeCompare(b.name)))
      })
      // Without the list the filter offers all closers only, and the report still works.
      .catch(() => {
        if (!cancelled) setClosers([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession((token) =>
          fetchSales(
            range,
            { teamId: teamId || null, closerId: closerId || null, limit: PAGE_SIZE, offset },
            token
          )
        )
      )
      .then((report) => {
        if (!cancelled) setLoad({ status: 'ready', report })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [range, teamId, closerId, offset])

  const offered = teamId ? closers.filter((closer) => closer.team_id === teamId) : closers
  const report = load.status === 'ready' ? load.report : null

  function chooseCloser(next: string) {
    setCloserId(next)
    setOffset(0)
    setLoad({ status: 'loading' })
  }

  return (
    <DataTable
      title="Sales"
      ariaLabel="Sales made during these dates"
      toolbar={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-[220px]">
              <Select
                label="Agent"
                value={closerId}
                onChange={(event) => chooseCloser(event.target.value)}
              >
                <option value="">All closers</option>
                {offered.map((closer) => (
                  <option key={closer.id} value={closer.id}>
                    {closer.name}
                  </option>
                ))}
              </Select>
            </div>
            {report && (
              <p className="text-sm leading-[140%] text-slate tabular-nums">
                {report.totals.count} {report.totals.count === 1 ? 'sale' : 'sales'} · Total{' '}
                {formatMoney(report.totals.total_payment)} · Down{' '}
                {formatMoney(report.totals.down_payment)} · Monthly{' '}
                {formatMoney(report.totals.monthly_payment)}
              </p>
            )}
          </div>
          {load.status === 'error' && <Alert>{load.message}</Alert>}
        </div>
      }
      rows={report?.items ?? []}
      columns={COLUMNS}
      getRowId={(sale) => sale.interaction_id}
      emptyMessage={
        load.status === 'loading'
          ? 'Loading sales…'
          : load.status === 'error'
            ? 'No sales to show.'
            : 'No sales during these dates.'
      }
      paginate={false}
      paging={
        report
          ? {
              total: report.total,
              limit: report.limit,
              offset: report.offset,
              onOffsetChange: (next) => {
                setOffset(next)
                setLoad({ status: 'loading' })
              },
            }
          : undefined
      }
      minWidth="max-content"
    />
  )
}
