'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { STAGE_LABEL } from '@/components/admin/FunnelChart'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { AuthError, isSuperAdmin } from '@/lib/auth'
import { formatDateTimeIn, formatPhone, formatZone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  fetchFunnelStage,
  type FunnelLead,
  type FunnelLeadList,
  type FunnelStage,
  type HistoricalFunnel,
} from '@/lib/reporting'
import { withSession } from '@/lib/session'

const PAGE_LIMIT = 10

/** How far a lead got, worded for a row rather than a bar. */
const REACHED: Record<FunnelStage, string> = {
  leads: 'Added',
  qualified: 'Qualified',
  transferred: 'Transferred',
  sold: 'Sold',
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: FunnelLeadList }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) return 'You no longer have access to reports.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load the leads behind this number.'
}

/** Per zone: rows are drawn in the one the figure above them was counted in. */
const columnsIn = (timeZone: string): DataColumn<FunnelLead>[] => [
  {
    id: 'lead',
    header: 'Lead',
    render: (row) => (
      <>
        <span className="font-medium">{row.lead_name}</span>
        <span className="mt-1 block text-xs text-slate">{formatPhone(row.lead_phone)}</span>
      </>
    ),
  },
  { id: 'team', header: 'Team', render: (row) => row.team_name },
  {
    id: 'added',
    header: 'Date added',
    render: (row) => (
      <span className="whitespace-nowrap">{formatDateTimeIn(row.created_at, timeZone)}</span>
    ),
  },
  { id: 'stage', header: 'Stage reached', render: (row) => REACHED[row.stage] },
  {
    id: 'fronter_outcome',
    header: 'Fronter outcome',
    render: (row) => <span className="whitespace-nowrap">{row.fronter_outcome ?? '-'}</span>,
  },
  {
    id: 'closer_outcome',
    header: 'Closer outcome',
    render: (row) => <span className="whitespace-nowrap">{row.closer_outcome ?? '-'}</span>,
  },
  {
    id: 'actions',
    header: 'Action',
    align: 'right',
    // MUI directly rather than our Button: that renders a <button> where this
    // navigates, and is `fullWidth`, which in a cell stretches to the column.
    render: (row) => (
      <MuiButton
        component={Link}
        href={`/admin/reports/lead/?id=${encodeURIComponent(row.lead_id)}`}
        variant="outlined"
        size="small"
      >
        Open<span className="sr-only"> {row.lead_name}</span>
      </MuiButton>
    ),
  },
]

/**
 * The leads behind one funnel number.
 *
 * Takes the funnel that was answered, never the range that was asked for: on
 * the first read those can differ, and only the reply carries a zone.
 */
export function FunnelLeads({
  id,
  stage,
  funnel,
  teamId,
}: {
  /** What the bars' `aria-controls` points at; every state carries it. */
  id: string
  stage: FunnelStage
  funnel: HistoricalFunnel
  /** The team the funnel was read for, so the list counts the same leads. */
  teamId: string | null
}) {
  const [offset, setOffset] = useState(0)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const { user } = useCurrentUser()
  const canOpen = Boolean(user && isSuperAdmin(user.roles))

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession((token) =>
          fetchFunnelStage(stage, funnel, teamId, { limit: PAGE_LIMIT, offset }, token)
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
  }, [stage, funnel, teamId, offset])

  if (load.status === 'loading') {
    return (
      <p
        id={id}
        className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate"
      >
        Loading leads…
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

  const heading = stage === 'leads' ? 'Leads' : `Leads behind ${STAGE_LABEL[stage]}`

  return (
    <DataTable
      id={id}
      title={heading}
      ariaLabel={heading}
      rows={load.list.items}
      // Opening a lead is the Super Admin's alone.
      columns={columnsIn(load.list.timezone).filter(
        (column) => canOpen || column.id !== 'actions'
      )}
      getRowId={(row) => row.lead_id}
      minWidth="max-content"
      emptyMessage="No leads reached this stage in these dates."
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
