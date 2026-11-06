'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { LeadSummaryDialog } from '@/components/admin/LeadSummaryDialog'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import {
  fetchAgentLeads,
  type AgentLeadItem,
  type AgentLeadList,
  type PeriodChoice,
} from '@/lib/agentStats'
import { AuthError } from '@/lib/auth'
import { displayTimeZone, formatDateTime, formatPhone } from '@/lib/format'
import type { StatsStage } from '@/lib/fronterStats'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

const PAGE_SIZE = 50

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: AgentLeadList }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  if (err instanceof AuthError && err.status === 404) return 'This agent is not on your team.'
  return 'Could not load this agent’s leads.'
}

function columnsFor(
  onSummary: ((row: AgentLeadItem) => void) | null
): DataColumn<AgentLeadItem>[] {
  return [
    { id: 'lead', header: 'Lead', render: (row) => row.lead_name },
    {
      id: 'phone',
      header: 'Phone',
      render: (row) => <span className="whitespace-nowrap">{formatPhone(row.lead_phone)}</span>,
    },
    { id: 'outcome', header: 'Outcome', render: (row) => row.outcome ?? 'Open' },
    {
      id: 'worked_at',
      header: 'When',
      render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.worked_at)}</span>,
    },
    {
      id: 'actions',
      header: 'Action',
      align: 'right',
      // MUI directly, as the Reports lists do: our Button is a full-width <button>.
      render: (row) =>
        onSummary ? (
          <MuiButton variant="outlined" size="small" onClick={() => onSummary(row)}>
            Summary<span className="sr-only"> {row.lead_name}</span>
          </MuiButton>
        ) : (
          <MuiButton
            component={Link}
            href={`/admin/reports/lead/?id=${encodeURIComponent(row.lead_id)}&from=agents`}
            variant="outlined"
            size="small"
          >
            Open<span className="sr-only"> {row.lead_name}</span>
          </MuiButton>
        ),
    },
  ]
}

/**
 * The leads one agent worked in the period, newest first. A Super Admin opens a
 * lead's full view; a Team Admin gets its summary, as Reports does.
 */
export function AgentLeadsTable({
  userId,
  stage,
  choice,
  canOpen,
}: {
  userId: string
  stage: StatsStage
  choice: PeriodChoice
  canOpen: boolean
}) {
  // The fields, not the object: a parent may build a new one every render.
  const { period, day } = choice
  const [offset, setOffset] = useState(0)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [summaryOf, setSummaryOf] = useState<AgentLeadItem | null>(null)

  // Adjusting state during render, not in an effect, when the period or agent changes.
  const [asked, setAsked] = useState({ period, day, userId, stage })
  if (
    asked.period !== period ||
    asked.day !== day ||
    asked.userId !== userId ||
    asked.stage !== stage
  ) {
    setAsked({ period, day, userId, stage })
    setOffset(0)
    setLoad({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession((token) =>
          fetchAgentLeads(userId, stage, { period, day }, { limit: PAGE_SIZE, offset }, token)
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
  }, [userId, stage, period, day, offset])

  const list = load.status === 'ready' ? load.list : null

  return (
    <>
      <DataTable
        title="Leads"
        ariaLabel="Leads this agent worked in the period"
        toolbar={load.status === 'error' ? <Alert>{load.message}</Alert> : undefined}
        rows={list?.items ?? []}
        columns={columnsFor(canOpen ? null : setSummaryOf)}
        getRowId={(row) => row.lead_id}
        emptyMessage={
          load.status === 'loading'
            ? 'Loading leads…'
            : load.status === 'error'
              ? 'No leads to show.'
              : 'No leads worked in this period.'
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
      {summaryOf && (
        <LeadSummaryDialog
          key={summaryOf.lead_id}
          lead={summaryOf}
          timeZone={displayTimeZone()}
          onClose={() => setSummaryOf(null)}
        />
      )}
    </>
  )
}
