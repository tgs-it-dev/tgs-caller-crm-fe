'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { snapshotExtras, snapshotValue } from '@/components/admin/InteractionPanels'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { revealCartNumbers, type CartNumbers } from '@/lib/cart'
import { formatDateTime, formatMoney, formatPhone, localZoneName } from '@/lib/format'
import { SOURCE_LABEL } from '@/lib/leadSource'
import {
  fetchLeadHistory,
  isLeadNotFound,
  type LeadHistory,
  type LeadHistoryEvent,
} from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; history: LeadHistory }

type Lead = LeadHistory['lead']
type Status = LeadHistory['status']
type Outcome = NonNullable<Status['latest_fronter']>
type Cart = LeadHistory['carts'][number]
type Row = LeadHistoryEvent & { id: string }

const HISTORY_PAGE_SIZE = 10

/** The fronter outcome that puts a lead on the team's callback list. */
const CALLBACK = 'Callback'

type Tone = 'neutral' | 'teal' | 'amber' | 'done'

export const STAGE_BADGE: Record<Status['stage'], { label: string; tone: Tone }> = {
  leads: { label: 'Added', tone: 'neutral' },
  qualified: { label: 'Qualified', tone: 'teal' },
  transferred: { label: 'Transferred', tone: 'amber' },
  sold: { label: 'Sold', tone: 'done' },
}

const FIELD_LABEL: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  phone_no: 'Phone',
  vehicle_year: 'Year',
  vehicle_make: 'Make',
  vehicle_model: 'Model',
  vin: 'VIN',
  license_plate: 'License plate',
}

/** Form answers the lead card already shows, so the form card leaves them out. */
const ON_THE_LEAD = new Set([...Object.keys(FIELD_LABEL), 'phone'])

/** How a transfer ended, when the next event doesn't already say so. */
const UNANSWERED: Partial<Record<string, { label: string; tone: 'red' | 'caution' }>> = {
  timeout: { label: 'Timed out', tone: 'red' },
  failed: { label: 'Failed', tone: 'red' },
  initiated: { label: 'Waiting', tone: 'caution' },
  offered: { label: 'Waiting', tone: 'caution' },
}

function messageFor(err: unknown): string {
  if (isLeadNotFound(err)) return 'There is no lead with that id.'
  if (err instanceof AuthError && err.status === 403)
    return 'You no longer have access to lead detail.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load this lead.'
}

function vehicleOf(lead: Lead) {
  return [lead.vehicle_year, lead.vehicle_make, lead.vehicle_model]
    .filter((part) => part !== null && part !== '')
    .join(' ')
}

function labelFor(key: string) {
  const words = key.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function Card({
  title,
  caption,
  actions,
  children,
}: {
  title: string
  caption?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="h-full min-w-0 rounded-xl border-hairline border-slate bg-white p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b-hairline border-light-grey pb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-[120%] text-ink">{title}</h2>
          {caption && <p className="mt-1 text-xs leading-[150%] text-slate">{caption}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

/** Labels beside their values; two pairs to a row when `wide` and there is room. */
function Pairs({ wide = false, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <dl
      className={`grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 ${
        wide ? 'md:grid-cols-[7rem_minmax(0,1fr)_7rem_minmax(0,1fr)]' : ''
      }`}
    >
      {children}
    </dl>
  )
}

function Pair({ label, meta, children }: { label: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm leading-[140%] text-slate">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium leading-[140%] text-ink">
        {children}
        {meta && (
          <span className="block text-xs font-normal leading-[150%] text-slate">{meta}</span>
        )}
      </dd>
    </>
  )
}

function who(outcome: Outcome) {
  return [outcome.actor_name, formatDateTime(outcome.at)].filter(Boolean).join(' · ')
}

function since(outcome: Outcome) {
  return [`Since ${formatDateTime(outcome.at)}`, outcome.actor_name].filter(Boolean).join(' · ')
}

function LeadCard({ lead }: { lead: Lead }) {
  const by = lead.added_by_name ? ` by ${lead.added_by_name}` : ''
  return (
    <section className="h-full min-w-0 rounded-xl border-hairline border-slate bg-white p-5 lg:col-span-2">
      <h2 className="text-xl font-semibold leading-[120%] text-ink">{lead.lead_name}</h2>
      <p className="mt-1 text-sm leading-[140%] text-slate">
        Added {formatDateTime(lead.created_at)}
        {by}
      </p>
      <div className="mt-4 border-t-hairline border-light-grey pt-4">
        <Pairs wide>
          <Pair label="Phone">{formatPhone(lead.phone_no)}</Pair>
          <Pair label="Vehicle">{vehicleOf(lead) || '-'}</Pair>
          <Pair label="Team">{lead.team_name}</Pair>
          <Pair label="VIN">{lead.vin ?? '-'}</Pair>
          <Pair label="Source">{SOURCE_LABEL[lead.source]}</Pair>
          <Pair label="License plate">{lead.license_plate ?? '-'}</Pair>
          <Pair label="Added by">{lead.added_by_name ?? '-'}</Pair>
          <Pair label="Last updated">{formatDateTime(lead.updated_at)}</Pair>
        </Pairs>
      </div>
    </section>
  )
}

function WhereItStands({ status }: { status: Status }) {
  const stage = STAGE_BADGE[status.stage]
  const { latest_fronter: fronter, latest_closer: closer, callback } = status
  return (
    <Card title="Where it stands">
      <Pairs>
        <Pair label="Stage">
          <Badge tone={stage.tone}>{stage.label}</Badge>
        </Pair>
        <Pair label="Latest fronter" meta={fronter && who(fronter)}>
          {fronter?.outcome ?? '-'}
        </Pair>
        <Pair label="Latest closer" meta={closer && who(closer)}>
          {closer?.outcome ?? '-'}
        </Pair>
        <Pair label="Callback" meta={callback && since(callback)}>
          {callback ? <Badge tone="caution">On the callback list</Badge> : 'Not on the list'}
        </Pair>
        {status.awaiting_closer && (
          <Pair label="Transfer">
            <Badge tone="caution">Waiting for a closer</Badge>
          </Pair>
        )}
        {status.with_closer && (
          <Pair label="On a call">
            <Badge tone="teal">With {status.with_closer}</Badge>
          </Pair>
        )}
        <Pair label="Do not call">
          {status.do_not_call ? <Badge tone="red">Do not call</Badge> : 'No'}
        </Pair>
        <Pair label="Calls">{status.calls}</Pair>
      </Pairs>
    </Card>
  )
}

function FronterForm({ form }: { form: LeadHistory['form'] }) {
  if (!form) {
    return (
      <Card title="Fronter form">
        <p className="text-sm text-slate">No form was saved for this lead.</p>
      </Card>
    )
  }
  const extras = snapshotExtras(form.snapshot).filter((key) => !ON_THE_LEAD.has(key))
  const by = form.saved_by ? ` by ${form.saved_by}` : ''
  const { consent } = form

  return (
    <Card
      title="Fronter form"
      caption={`Version ${form.version}, saved ${formatDateTime(form.saved_at)}${by}`}
    >
      <Pairs>
        <Pair
          label="Consent"
          meta={consent.consent_captured_at && formatDateTime(consent.consent_captured_at)}
        >
          {consent.consent_given ? 'Given' : 'Not given'}
        </Pair>
        <Pair label="Do not call">
          {consent.dnc_flagged
            ? `Yes${consent.dnc_source ? ` (${consent.dnc_source})` : ''}`
            : 'No'}
        </Pair>
        {extras.length === 0 ? (
          <Pair label="Other answers">
            <span className="font-normal text-slate">None recorded</span>
          </Pair>
        ) : (
          extras.map((key) => (
            <Pair key={key} label={labelFor(key)}>
              {snapshotValue(form.snapshot[key])}
            </Pair>
          ))
        )}
      </Pairs>
    </Card>
  )
}

type Reveal =
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'shown'; numbers: CartNumbers }
  | { status: 'error' }

/** A call's cart, masked until a Super Admin asks to see the full numbers. */
function CartCard({ cart, call, revealable }: { cart: Cart; call?: number; revealable: boolean }) {
  const [reveal, setReveal] = useState<Reveal>({ status: 'hidden' })
  const shown = reveal.status === 'shown' ? reveal.numbers : null
  const by = cart.saved_by ? ` by ${cart.saved_by}` : ''

  const show = () => {
    setReveal({ status: 'loading' })
    withSession((token) => revealCartNumbers(cart.interaction_id, token))
      .then((numbers) => setReveal(numbers ? { status: 'shown', numbers } : { status: 'error' }))
      .catch(() => setReveal({ status: 'error' }))
  }

  const toggle =
    reveal.status === 'shown' ? (
      <button
        type="button"
        onClick={() => setReveal({ status: 'hidden' })}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-navy hover:underline"
      >
        <EyeOff className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        Hide numbers
      </button>
    ) : (
      <button
        type="button"
        onClick={show}
        disabled={reveal.status === 'loading'}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-navy hover:underline disabled:text-slate disabled:no-underline"
      >
        <Eye className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {reveal.status === 'loading' ? 'Showing…' : 'Show full numbers'}
      </button>
    )

  return (
    <Card
      title={call ? `Cart and payment · Call ${call}` : 'Cart and payment'}
      caption={`Saved ${formatDateTime(cart.saved_at)}${by}`}
      actions={revealable ? toggle : undefined}
    >
      {reveal.status === 'error' && (
        <p role="alert" className="mb-3 text-xs leading-[150%] text-status-red">
          Could not show the full numbers. Try again.
        </p>
      )}
      <Pairs wide>
        <Pair label="Account">
          <span className="tabular-nums">
            {shown ? shown.account_number : `•••• ${cart.account_last4}`}
          </span>
        </Pair>
        <Pair label="Total">{formatMoney(cart.total_payment)}</Pair>
        <Pair label="Routing">
          <span className="tabular-nums">
            {shown
              ? (shown.routing_number ?? '-')
              : cart.routing_last4
                ? `•••• ${cart.routing_last4}`
                : '-'}
          </span>
        </Pair>
        <Pair label="Down payment">{formatMoney(cart.down_payment)}</Pair>
        <Pair label="Expiry">{cart.expiry ?? '-'}</Pair>
        <Pair label="Monthly">{formatMoney(cart.monthly_payment)}</Pair>
        <Pair label="Policy number">{cart.policy_number ?? '-'}</Pair>
      </Pairs>
    </Card>
  )
}

function Carts({ history, revealable }: { history: LeadHistory; revealable: boolean }) {
  if (history.carts.length === 0) {
    return (
      <Card title="Cart and payment">
        <p className="text-sm text-slate">No cart was saved for this lead.</p>
      </Card>
    )
  }
  // Named by call only when there is more than one call to tell apart.
  const callOf = (cart: Cart) => {
    if (history.status.calls < 2) return undefined
    const onCall = history.events.find((event) => event.interaction_id === cart.interaction_id)
    return onCall?.call ?? undefined
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 [&>*]:flex-1">
      {history.carts.map((cart) => (
        <CartCard
          key={cart.interaction_id}
          cart={cart}
          call={callOf(cart)}
          revealable={revealable}
        />
      ))}
    </div>
  )
}

/** What happened, in words, with the pills and the detail that belong beside it. */
function describe(event: LeadHistoryEvent): {
  text: string
  badges: ReactNode[]
  detail?: ReactNode
} {
  const badges: ReactNode[] = []
  // A later version replaced an earlier outcome on the same call: a correction,
  // or the result of a worked callback. The system can't tell which, so say what
  // it replaced rather than calling it either.
  const replaced = event.previous_outcome ? `Changed from ${event.previous_outcome}` : undefined

  switch (event.kind) {
    case 'added':
      return { text: 'Lead added', badges }
    case 'lead_edited':
      return {
        text: 'Lead details edited',
        badges,
        detail: event.changes
          .map((change) => {
            const field = FIELD_LABEL[change.field] ?? change.field
            return `${field}: ${change.before ?? '-'} → ${change.after ?? '-'}`
          })
          .join(' · '),
      }
    case 'fronter_outcome':
      if (event.outcome === CALLBACK) {
        badges.push(
          <Badge key="callback" tone="caution">
            Callback
          </Badge>
        )
      }
      return { text: `Fronter outcome: ${event.outcome}`, badges, detail: replaced }
    case 'qualification':
      return {
        text: (event.version ?? 1) > 1 ? 'Fronter form updated' : 'Fronter form saved',
        badges,
        detail: `Version ${event.version}`,
      }
    case 'transfer_offered': {
      const unanswered = event.transfer_status ? UNANSWERED[event.transfer_status] : undefined
      if (unanswered) {
        badges.push(
          <Badge key="status" tone={unanswered.tone}>
            {unanswered.label}
          </Badge>
        )
      }
      if (event.reason) {
        badges.push(
          <Badge key="override" tone="amber">
            Checks skipped
          </Badge>
        )
      }
      return {
        text: `Transfer offered to ${event.closer_name ?? 'any closer'}`,
        badges,
        detail: event.reason ?? undefined,
      }
    }
    case 'transfer_accepted':
      badges.push(
        <Badge key="accepted" tone="teal">
          Accepted
        </Badge>
      )
      return { text: 'Transfer accepted', badges }
    case 'transfer_rejected':
      badges.push(
        <Badge key="rejected" tone="red">
          Rejected
        </Badge>
      )
      return { text: 'Transfer rejected', badges }
    case 'cart_saved': {
      const amounts = event.amounts
      const parts = amounts && [
        `Total ${formatMoney(amounts.total_payment)}`,
        `Down ${formatMoney(amounts.down_payment)}`,
        `Monthly ${formatMoney(amounts.monthly_payment)}`,
        ...(amounts.policy_number ? [`Policy ${amounts.policy_number}`] : []),
      ]
      return { text: 'Cart saved', badges, detail: parts?.join(' · ') }
    }
    case 'closer_outcome':
      return { text: `Closer outcome: ${event.outcome}`, badges, detail: replaced }
    case 'sold':
      badges.push(
        <Badge key="sold" tone="done">
          Sold
        </Badge>
      )
      return { text: 'Sold', badges, detail: event.outcome }
    case 'do_not_call':
      badges.push(
        <Badge key="dnc" tone="red">
          Do not call
        </Badge>
      )
      return {
        text: 'Number added to the do-not-call list',
        badges,
        detail: event.reason ?? undefined,
      }
  }
}

function historyColumns(calls: number): DataColumn<Row>[] {
  return [
    {
      id: 'time',
      header: 'Time',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.at)}</span>
      ),
    },
    // Only when there is more than one call to tell apart.
    ...(calls > 1
      ? [
          {
            id: 'call',
            header: 'Call',
            render: (row: Row) => (row.call ? `Call ${row.call}` : '-'),
          },
        ]
      : []),
    {
      id: 'event',
      header: 'Event',
      render: (row) => {
        const { text, badges } = describe(row)
        return (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{text}</span>
            {badges}
          </span>
        )
      },
    },
    {
      id: 'detail',
      header: 'Details',
      render: (row) => (
        <span className="text-sm text-body-text">{describe(row).detail ?? ''}</span>
      ),
    },
    {
      id: 'by',
      header: 'By',
      render: (row) => <span className="whitespace-nowrap">{row.actor_name ?? '-'}</span>,
    },
  ]
}

function History({ history }: { history: LeadHistory }) {
  const rows: Row[] = history.events.map((event, index) => ({ ...event, id: String(index) }))
  return (
    <DataTable
      title="History"
      ariaLabel="Everything that happened to this lead"
      actions={
        <span className="whitespace-nowrap text-xs leading-[150%] text-slate">
          Oldest first · Times in {localZoneName()}
        </span>
      }
      rows={rows}
      columns={historyColumns(history.status.calls)}
      getRowId={(row) => row.id}
      getRowSx={(row) => (row.kind === 'sold' ? { backgroundColor: tokens.strip } : undefined)}
      emptyMessage="Nothing has happened to this lead yet."
      pageSize={HISTORY_PAGE_SIZE}
      minWidth={760}
    />
  )
}

/**
 * Everything recorded on a lead and everything that happened to it. Only a Super
 * Admin may show a cart's full numbers, so anyone else gets it masked.
 */
export function LeadRecord({
  history,
  revealable = false,
}: {
  history: LeadHistory
  revealable?: boolean
}) {
  return (
    <div className="space-y-5">
      {/* Rows stretch, so cards side by side end level rather than leaving a gap. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <LeadCard lead={history.lead} />
        <WhereItStands status={history.status} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <FronterForm form={history.form} />
        <Carts history={history} revealable={revealable} />
      </div>
      <History history={history} />
    </div>
  )
}

/** Where the back link goes: Policy lookup when it opened the lead, Reports otherwise. */
const POLICIES = { href: '/admin/policies', label: 'Back to Policy lookup' }
const REPORTS = { href: '/admin/reports', label: 'Back to Reports' }

/** A Super Admin's view of one lead: everything recorded on it, and everything that happened. */
export function LeadDetailScreen() {
  const params = useSearchParams()
  const leadId = params.get('id') ?? ''
  const back = params.get('from') === 'policies' ? POLICIES : REPORTS
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  // Adjusting state during render, not in an effect, when another lead is opened.
  const [shown, setShown] = useState(leadId)
  if (shown !== leadId) {
    setShown(leadId)
    setLoad({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => fetchLeadHistory(leadId, token)))
      .then((history) => {
        if (!cancelled) setLoad({ status: 'ready', history })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [leadId])

  return (
    <PageShell
      title={
        <Link href={back.href} className="group inline-flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border-hairline border-slate bg-white text-ink group-hover:bg-shop-floor">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          {back.label}
        </Link>
      }
    >
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading this lead…
        </p>
      )}
      {load.status === 'error' && <Alert>{load.message}</Alert>}
      {load.status === 'ready' && <LeadRecord history={load.history} revealable />}
    </PageShell>
  )
}
