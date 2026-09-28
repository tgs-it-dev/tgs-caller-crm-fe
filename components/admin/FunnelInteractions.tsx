'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { STAGE_LABEL } from '@/components/admin/FunnelChart'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { AuthError } from '@/lib/auth'
import { formatDateTimeIn, formatPhone, formatZone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  fetchFunnelStage,
  type FunnelInteraction,
  type FunnelInteractionList,
  type FunnelStage,
  type HistoricalFunnel,
} from '@/lib/reporting'
import { withSession } from '@/lib/session'

const PAGE_LIMIT = 10

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: FunnelInteractionList }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) return 'You no longer have access to reports.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load the interactions behind this number.'
}

/** Per zone: rows are drawn in the one the figure above them was counted in. */
const columnsIn = (timeZone: string): DataColumn<FunnelInteraction>[] => [
  {
    id: 'started',
    header: 'Started',
    render: (row) => (
      <span className="whitespace-nowrap">{formatDateTimeIn(row.created_at, timeZone)}</span>
    ),
  },
  {
    // The only field on the row a reader recognises. Leads have no name to
    // show — the contract says so — so the number is the whole identity.
    id: 'lead',
    header: 'Lead',
    render: (row) => <span className="whitespace-nowrap">{formatPhone(row.lead_phone)}</span>,
  },
  {
    id: 'interaction',
    header: 'Interaction',
    render: (row) => (
      <span className="whitespace-nowrap font-mono text-xs">{row.id}</span>
    ),
  },
  {
    id: 'actions',
    header: <span className="sr-only">Actions</span>,
    align: 'right',
    // MUI directly rather than our Button: that renders a <button> where this
    // navigates, and is `fullWidth`, which in a cell stretches to the column.
    render: (row) => (
      <MuiButton
        component={Link}
        href={`/admin/interactions/?id=${encodeURIComponent(row.id)}&from=funnel`}
        variant="outlined"
        size="small"
      >
        {/* Ten of these read alike without it. The phone is the only thing on
            the row worth hearing; a uuid spelled out is worse than nothing. */}
        Detail<span className="sr-only"> for {formatPhone(row.lead_phone)}</span>
      </MuiButton>
    ),
  },
]

/**
 * The interactions behind one funnel number.
 *
 * Takes the funnel that was answered, never the range that was asked for — on
 * the first read those can differ, and only the reply carries a zone.
 */
export function FunnelInteractions({
  id,
  stage,
  funnel,
}: {
  /** What the bars' `aria-controls` points at — every state carries it. */
  id: string
  stage: FunnelStage
  funnel: HistoricalFunnel
}) {
  const [offset, setOffset] = useState(0)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession((token) =>
          fetchFunnelStage(stage, funnel, { limit: PAGE_LIMIT, offset }, token)
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
  }, [stage, funnel, offset])

  if (load.status === 'loading') {
    return (
      <p
        id={id}
        className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate"
      >
        Loading interactions…
      </p>
    )
  }

  if (load.status === 'error') {
    return (
      <div id={id}>
        <Alert>{load.message}</Alert>
      </div>
    )
  }

  const heading = `Interactions behind ${STAGE_LABEL[stage]}`

  return (
    <DataTable
      id={id}
      title={heading}
      ariaLabel={heading}
      rows={load.list.items}
      columns={columnsIn(load.list.timezone)}
      getRowId={(row) => row.id}
      // Ids and timestamps that must not wrap; the card scrolls if a viewport
      // is too narrow to hold them.
      minWidth="max-content"
      emptyMessage="No interactions reached this stage in this range."
      paging={{
        total: load.list.total,
        limit: load.list.limit,
        offset: load.list.offset,
        onOffsetChange: (next) => {
          setLoad({ status: 'loading' })
          setOffset(next)
        },
      }}
      actions={
        // The zone the figures were counted in, not the reader's, so the card
        // and the window above the chart name the same one.
        <span className="whitespace-nowrap text-xs leading-[150%] text-slate">
          Times in {formatZone(funnel.end, load.list.timezone)}
        </span>
      }
    />
  )
}
