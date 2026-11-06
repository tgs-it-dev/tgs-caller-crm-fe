'use client'

import { useEffect, useState, type ReactNode } from 'react'
import MuiButton from '@mui/material/Button'
import { Pair, Pairs, STAGE_BADGE, vehicleOf } from '@/components/admin/LeadDetailScreen'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { formatDateTimeIn, formatPhone } from '@/lib/format'
import { SOURCE_LABEL } from '@/lib/leadSource'
import { fetchLeadSummary, isLeadNotFound, type LeadSummary } from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import type { FunnelLead } from '@/lib/reporting'
import { withSession } from '@/lib/session'

const LABEL = 'text-xs font-medium uppercase tracking-wide text-slate'

type Status = LeadSummary['status']
type Outcome = Status['latest_fronter']

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t-hairline border-light-grey pt-4">
      <p className={`mb-3 ${LABEL}`}>{title}</p>
      {children}
    </div>
  )
}

function SummaryDetails({ summary, timeZone }: { summary: LeadSummary; timeZone: string }) {
  const { lead, status, sale } = summary
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

      {/* Name and phone are already in the title. */}
      <Section title="Lead">
        <Pairs>
          <Pair label="Vehicle">{vehicleOf(lead) || '-'}</Pair>
          <Pair label="VIN">{lead.vin ?? '-'}</Pair>
          <Pair label="License plate">{lead.license_plate ?? '-'}</Pair>
          <Pair label="Source">{SOURCE_LABEL[lead.source]}</Pair>
          <Pair label="Added by">{lead.added_by_name ?? '-'}</Pair>
        </Pairs>
      </Section>

      {sale && (
        <Section title="Sale">
          <Pairs>
            <Pair label="Policy">{sale.policy_number ?? '-'}</Pair>
            <Pair label="Sold">{formatDateTimeIn(sale.sold_at, timeZone)}</Pair>
          </Pairs>
        </Section>
      )}
    </div>
  )
}

/**
 * What a Team Admin sees of a lead, opened from a Reports row, a policy lookup
 * match or an agent's leads. The row supplies the name, phone and any stage, so
 * those show while the rest loads. No card details or amounts: those are a Super
 * Admin's.
 */
export function LeadSummaryDialog({
  lead,
  timeZone,
  onClose,
}: {
  lead: Pick<FunnelLead, 'lead_id' | 'lead_name' | 'lead_phone'> &
    Partial<Pick<FunnelLead, 'stage'>>
  /** The zone the opening list is drawn in. */
  timeZone: string
  onClose: () => void
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const stage = lead.stage ? STAGE_BADGE[lead.stage] : null
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
      titleAside={stage ? <Badge tone={stage.tone}>{stage.label}</Badge> : undefined}
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
