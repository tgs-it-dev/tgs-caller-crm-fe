'use client'

import { useEffect, useState } from 'react'
import MuiButton from '@mui/material/Button'
import { STAGE_BADGE } from '@/components/admin/LeadDetailScreen'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { formatDateTimeIn, formatMoney, formatPhone } from '@/lib/format'
import { fetchLeadSummary, isLeadNotFound, type LeadSummary } from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import type { FunnelLead } from '@/lib/reporting'
import { withSession } from '@/lib/session'

const LABEL = 'text-xs font-medium uppercase tracking-wide text-slate'

type Status = LeadSummary['status']
type Outcome = Status['latest_fronter']
type Sale = NonNullable<LeadSummary['sale']>

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: LeadSummary }

function messageFor(err: unknown): string {
  if (isLeadNotFound(err)) return 'This lead is no longer available.'
  return 'Could not load this summary.'
}

/** One side of the handover. A closer still on the call has no outcome to show yet. */
function WorkedBy({
  title,
  outcome,
  onCall = null,
  timeZone,
}: {
  title: string
  outcome: Outcome
  onCall?: string | null
  timeZone: string
}) {
  const name = outcome ? (outcome.actor_name ?? '-') : onCall

  return (
    <div className="min-w-0 rounded-lg border-hairline border-slate p-3">
      <p className={LABEL}>{title}</p>
      {name ? (
        <>
          <p className="mt-2 break-words text-sm font-medium leading-[140%] text-ink">{name}</p>
          <p className="break-words text-sm leading-[140%] text-body-text">
            {outcome?.outcome ?? 'On a call'}
          </p>
          {outcome && (
            <p className="mt-1 text-xs leading-[150%] text-slate">
              {formatDateTimeIn(outcome.at, timeZone)}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm leading-[140%] text-slate">Not yet</p>
      )}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium leading-[140%] text-ink tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function SaleFigures({ sale, timeZone }: { sale: Sale; timeZone: string }) {
  return (
    <>
      <p className={LABEL}>Total</p>
      <p className="mt-1 text-2xl font-semibold leading-[120%] text-ink tabular-nums">
        {formatMoney(sale.total_payment)}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Figure label="Down" value={formatMoney(sale.down_payment)} />
        <Figure label="Monthly" value={formatMoney(sale.monthly_payment)} />
        <Figure label="Policy" value={sale.policy_number ?? '-'} />
      </dl>
      <p className="mt-3 text-xs leading-[150%] text-slate">
        Sold {formatDateTimeIn(sale.sold_at, timeZone)}
      </p>
    </>
  )
}

function SummaryDetails({ summary, timeZone }: { summary: LeadSummary; timeZone: string }) {
  const { status, sale } = summary
  const { latest_fronter: fronter, latest_closer: closer, callback } = status
  const notes = [
    callback && (
      <Badge key="callback" tone="caution">
        On the callback list
      </Badge>
    ),
    status.awaiting_closer && (
      <Badge key="waiting" tone="caution">
        Waiting for a closer
      </Badge>
    ),
    closer && status.with_closer && (
      <Badge key="on-a-call" tone="teal">
        With {status.with_closer}
      </Badge>
    ),
    status.do_not_call && (
      <Badge key="do-not-call" tone="red">
        Do not call
      </Badge>
    ),
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <WorkedBy title="Fronter" outcome={fronter} timeZone={timeZone} />
        <WorkedBy title="Closer" outcome={closer} onCall={status.with_closer} timeZone={timeZone} />
      </div>

      {notes.length > 0 && <div className="flex flex-wrap gap-2">{notes}</div>}

      {status.stage === 'sold' && (
        <div className="border-t-hairline border-light-grey pt-4">
          {sale ? (
            <SaleFigures sale={sale} timeZone={timeZone} />
          ) : (
            <p className="text-sm leading-[150%] text-body-text">
              No cart was saved for this sale.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * What a Team Admin sees of a lead, opened from a Reports row. The row supplies
 * the name, phone and stage, so those show while the rest loads.
 */
export function LeadSummaryDialog({
  lead,
  timeZone,
  onClose,
}: {
  lead: FunnelLead
  /** The zone the Reports list is drawn in. */
  timeZone: string
  onClose: () => void
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const stage = STAGE_BADGE[lead.stage]
  // The API falls back to the phone for a lead with no name.
  const named = lead.lead_name !== lead.lead_phone

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => fetchLeadSummary(lead.lead_id, token)))
      .then((summary) => {
        if (!cancelled) setLoad({ status: 'ready', summary })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [lead.lead_id])

  return (
    <Dialog
      open
      dismissible
      title={named ? lead.lead_name : formatPhone(lead.lead_phone)}
      titleAside={<Badge tone={stage.tone}>{stage.label}</Badge>}
      onClose={onClose}
      actions={
        // MUI directly: our Button is `fullWidth`, which outweighs the summary.
        <MuiButton variant="outlined" size="small" onClick={onClose}>
          Close
        </MuiButton>
      }
    >
      {named && (
        <p className="mb-4 text-sm leading-[150%] text-slate">{formatPhone(lead.lead_phone)}</p>
      )}
      {load.status === 'loading' && (
        <p className="py-6 text-center text-sm text-slate">Loading summary…</p>
      )}
      {load.status === 'error' && <Alert>{load.message}</Alert>}
      {load.status === 'ready' && <SummaryDetails summary={load.summary} timeZone={timeZone} />}
    </Dialog>
  )
}
