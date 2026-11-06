'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MuiButton from '@mui/material/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Input'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  POLICY_STATUS_LABEL,
  POLICY_STATUS_TONE,
  findSales,
  listPending,
  type RetentionSale,
  type RetentionSaleList,
} from '@/lib/retention'
import { withSession } from '@/lib/session'

const PAGE_SIZE = 20

type PendingLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: RetentionSaleList }

export function saleHref(base: string, sale: { interaction_id: string }) {
  return `${base}/sale/?id=${encodeURIComponent(sale.interaction_id)}`
}

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return fallback
}

function saleColumns(base: string): DataColumn<RetentionSale>[] {
  return [
    {
      id: 'policy',
      header: 'Policy',
      render: (sale) => <span className="font-medium text-ink">{sale.policy_number}</span>,
    },
    { id: 'customer', header: 'Customer', render: (sale) => sale.lead_name },
    { id: 'team', header: 'Team', render: (sale) => sale.team_name },
    {
      id: 'status',
      header: 'Status',
      render: (sale) =>
        sale.status ? (
          <Badge tone={POLICY_STATUS_TONE[sale.status]}>{POLICY_STATUS_LABEL[sale.status]}</Badge>
        ) : (
          <span className="text-slate">No status</span>
        ),
    },
    {
      id: 'updated',
      header: 'Updated',
      render: (sale) =>
        sale.status_at ? (
          <>
            <span className="whitespace-nowrap">{formatDateTime(sale.status_at)}</span>
            {sale.status_by && (
              <span className="mt-1 block text-xs text-slate">by {sale.status_by}</span>
            )}
          </>
        ) : (
          <span className="text-slate">-</span>
        ),
    },
    {
      id: 'open',
      header: '',
      align: 'right',
      render: (sale) => (
        <MuiButton component={Link} href={saleHref(base, sale)} variant="outlined" size="small">
          Open<span className="sr-only"> {sale.policy_number}</span>
        </MuiButton>
      ),
    },
  ]
}

/**
 * Find a sale by its whole policy number, which belongs to that one sale, and work
 * the policies that are Pending. Nothing else is listed: Retention never browses
 * the sales.
 */
export function RetentionScreen({ base }: { base: string }) {
  const router = useRouter()
  const [number, setNumber] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [searchProblem, setSearchProblem] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [load, setLoad] = useState<PendingLoad>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    waitForMocking()
      .then(() => withSession((token) => listPending({ limit: PAGE_SIZE, offset }, token)))
      .then((page) => {
        if (!cancelled) setLoad({ status: 'ready', page })
      })
      .catch((err) => {
        if (!cancelled) {
          setLoad({ status: 'error', message: messageFor(err, 'Could not load the Pending list.') })
        }
      })
    return () => {
      cancelled = true
    }
  }, [offset])

  function search(event: FormEvent) {
    event.preventDefault()
    const wanted = number.trim()
    if (!wanted) {
      setSearchProblem('Type a policy number.')
      return
    }
    setSearching(true)
    setSearchProblem(null)
    setNotFound(null)
    withSession((token) => findSales(wanted, token))
      .then(([sale]) => {
        if (sale) router.push(saleHref(base, sale))
        else setNotFound(wanted)
      })
      .catch((err) => setSearchProblem(messageFor(err, 'Could not search. Try again.')))
      .finally(() => setSearching(false))
  }

  const columns = saleColumns(base)
  const page = load.status === 'ready' ? load.page : null

  return (
    <PageShell title="Retention">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <section className="rounded-xl border-hairline border-slate bg-white p-5">
          <h2 className="mb-4 border-b-hairline border-light-grey pb-3 text-base font-semibold leading-[120%] text-ink">
            Find a policy
          </h2>
          <form onSubmit={search} className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-[320px]">
              <Input
                label="Policy number"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                error={Boolean(searchProblem)}
                helperText={searchProblem ?? 'The whole number, in any case.'}
                autoComplete="off"
              />
            </div>
            <div className="w-[128px] pb-6">
              <Button type="submit" size="small" isLoading={searching} loadingText="Finding…">
                Find
              </Button>
            </div>
          </form>
          {notFound && (
            <p className="text-sm leading-[150%] text-slate" aria-live="polite">
              No sale has the policy number {notFound}.
            </p>
          )}
        </section>

        {load.status === 'error' && <Alert>{load.message}</Alert>}
        <DataTable
          title="Pending"
          ariaLabel="The policies that are Pending"
          rows={page?.items ?? []}
          columns={columns}
          getRowId={(sale) => sale.interaction_id}
          emptyMessage={load.status === 'loading' ? 'Loading…' : 'No policies are Pending.'}
          paginate={false}
          paging={
            page
              ? {
                  total: page.total,
                  limit: page.limit,
                  offset: page.offset,
                  onOffsetChange: setOffset,
                }
              : undefined
          }
          minWidth="max-content"
        />
      </div>
    </PageShell>
  )
}
