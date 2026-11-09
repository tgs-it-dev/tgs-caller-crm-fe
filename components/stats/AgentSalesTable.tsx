'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Segmented } from '@/components/ui/Segmented'
import {
  SALE_KIND_LABEL,
  fetchAgentSales,
  fetchMySales,
  type AgentSaleItem,
  type AgentSaleKind,
  type AgentSaleList,
  type PeriodChoice,
} from '@/lib/agentStats'
import { AuthError } from '@/lib/auth'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { StatsStage } from '@/lib/fronterStats'
import { waitForMocking } from '@/lib/mockReady'
import { formatMonth } from '@/lib/policies'
import { POLICY_STATUS_LABEL, POLICY_STATUS_TONE } from '@/lib/retention'
import { withSession } from '@/lib/session'

const PAGE_SIZE = 50

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: AgentSaleList }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  if (err instanceof AuthError && err.status === 403)
    return 'You no longer have access to these sales.'
  return 'Could not load these sales.'
}

function amount(value: string | null) {
  return value === null ? '-' : formatMoney(value)
}

function columnsFor(stage: StatsStage, amounts: boolean): DataColumn<AgentSaleItem>[] {
  return [
    { id: 'lead', header: 'Lead', render: (sale) => sale.lead_name },
    ...(stage === 'fronter'
      ? [{ id: 'closer', header: 'Closer', render: (sale: AgentSaleItem) => sale.closer_name }]
      : []),
    {
      id: 'sold_at',
      header: 'Sale date',
      render: (sale) => <span className="whitespace-nowrap">{formatDateTime(sale.sold_at)}</span>,
    },
    { id: 'policy', header: 'Policy number', render: (sale) => sale.policy_number ?? '-' },
    {
      id: 'status',
      header: 'Status',
      render: (sale) =>
        sale.policy_status ? (
          <Badge tone={POLICY_STATUS_TONE[sale.policy_status]}>
            {POLICY_STATUS_LABEL[sale.policy_status]}
          </Badge>
        ) : (
          '-'
        ),
    },
    ...(stage === 'closer'
      ? [
          {
            id: 'paid',
            header: 'Paid',
            render: (sale: AgentSaleItem) =>
              sale.paid_month ? (
                <span className="whitespace-nowrap">{formatMonth(sale.paid_month, 'short')}</span>
              ) : (
                '-'
              ),
          },
        ]
      : []),
    {
      id: 'score',
      header: 'QA score',
      align: 'right',
      render: (sale) => <span className="tabular-nums">{sale.qa_score ?? '-'}</span>,
    },
    {
      id: 'note',
      header: 'QA notes',
      render: (sale) => (
        <span className="block min-w-[180px] max-w-[320px] whitespace-normal">
          {sale.qa_note ?? '-'}
        </span>
      ),
    },
    ...(amounts
      ? ([
          { id: 'total', header: 'Total', align: 'right', render: (s) => amount(s.total_payment) },
          { id: 'down', header: 'Down', align: 'right', render: (s) => amount(s.down_payment) },
          {
            id: 'monthly',
            header: 'Monthly',
            align: 'right',
            render: (s) => amount(s.monthly_payment),
          },
        ] satisfies DataColumn<AgentSaleItem>[])
      : []),
  ]
}

/**
 * The sales behind an agent's Sold, Paid or Cancelled figure, newest first. Paid
 * is counted by month, so its tab shows on a month only. A fronter has Sold only.
 * With no `userId`, the signed-in closer's own.
 */
export function AgentSalesTable({
  userId,
  stage,
  choice,
  amounts = false,
}: {
  userId: string | null
  stage: StatsStage
  choice: PeriodChoice
  /** A Super Admin's view: the amounts come back, so they get columns. */
  amounts?: boolean
}) {
  // The fields, not the object: a parent may build a new one every render.
  const { period, day } = choice
  const monthly = period === 'month'
  const kinds: AgentSaleKind[] =
    stage === 'closer' ? ['sold', ...(monthly ? (['paid'] as const) : []), 'cancelled'] : ['sold']
  const [picked, setPicked] = useState<AgentSaleKind>('sold')
  const kind = kinds.includes(picked) ? picked : 'sold'
  const [offset, setOffset] = useState(0)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  // Adjusting state during render, not in an effect, when the period or agent changes.
  const [asked, setAsked] = useState({ period, day, userId })
  if (asked.period !== period || asked.day !== day || asked.userId !== userId) {
    setAsked({ period, day, userId })
    setOffset(0)
    setLoad({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false
    const page = { limit: PAGE_SIZE, offset }
    const asking = { period, day }

    waitForMocking()
      .then(() =>
        withSession((token) =>
          userId
            ? fetchAgentSales(userId, stage, asking, kind, page, token)
            : fetchMySales(asking, kind, page, token)
        )
      )
      .then((list) => {
        if (!cancelled) setLoad({ status: 'ready', list })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [userId, stage, period, day, kind, offset])

  function choose(next: AgentSaleKind) {
    setPicked(next)
    setOffset(0)
    setLoad({ status: 'loading' })
  }

  const list = load.status === 'ready' ? load.list : null

  return (
    <DataTable
      title="Policies"
      ariaLabel={`${SALE_KIND_LABEL[kind]} policies`}
      toolbar={
        <div className="flex flex-col gap-3">
          {kinds.length > 1 && (
            <Segmented
              label="Which policies"
              options={kinds.map((value) => ({ value, label: SALE_KIND_LABEL[value] }))}
              value={kind}
              onChange={choose}
            />
          )}
          {load.status === 'error' && <Alert>{load.message}</Alert>}
        </div>
      }
      rows={list?.items ?? []}
      columns={columnsFor(stage, amounts)}
      getRowId={(sale) => sale.interaction_id}
      emptyMessage={
        load.status === 'loading'
          ? 'Loading policies…'
          : load.status === 'error'
            ? 'No policies to show.'
            : `No ${SALE_KIND_LABEL[kind].toLowerCase()} policies in this period.`
      }
      paginate={false}
      paging={
        list
          ? {
              total: list.total,
              limit: list.limit,
              offset: list.offset,
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
