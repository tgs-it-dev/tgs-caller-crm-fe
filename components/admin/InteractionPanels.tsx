'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { formatDateTime, localZoneName } from '@/lib/format'
import type {
  CallLeg,
  InteractionEvent,
  InteractionEventList,
  InteractionTransfer,
  QualificationRecord,
} from '@/lib/interactionDetail'

/** Why a panel is empty. Sits under the card, only where a reader needs it. */
function PanelNote({ children }: { children: ReactNode }) {
  return <p className="mt-2 px-1 text-xs leading-[150%] text-slate">{children}</p>
}

const NOT_RECORDED = <span className="text-slate">Not recorded</span>

/** A header or timestamp that reads as one line, the way the design draws it. */
function OneLine({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>
}

/**
 * The zone every timestamp in this card is drawn in, said once.
 *
 * Repeating it in each cell costs more width than the data, and these tables
 * sit in half a row. Said once it is still said.
 */
function ZoneCaption() {
  return <span className="text-xs leading-[150%] text-slate">Times in {localZoneName()}</span>
}

export function CallLegsPanel({ legs }: { legs: CallLeg[] }) {
  // The design numbers the legs. The order is the service's — earliest first —
  // so the ordinal is positional and belongs here, not in the response.
  const ordinals = new Map(legs.map((leg, index) => [leg.id, index + 1]))

  const columns: DataColumn<CallLeg>[] = [
    { id: 'leg', header: 'Leg', render: (leg) => ordinals.get(leg.id) },
    {
      id: 'call',
      header: <OneLine>VICIdial Call_ID</OneLine>,
      render: (leg) => (
        <span className="whitespace-nowrap font-mono text-xs text-black">
          {leg.vicidial_call_id}
        </span>
      ),
    },
    {
      id: 'started',
      header: 'Start',
      // Never the row's created_at: an absent start is worth showing as absent.
      render: (leg) => (
        <OneLine>{leg.started_at ? formatDateTime(leg.started_at) : NOT_RECORDED}</OneLine>
      ),
    },
    {
      id: 'ended',
      header: 'End',
      render: (leg) => (
        <OneLine>{leg.ended_at ? formatDateTime(leg.ended_at) : NOT_RECORDED}</OneLine>
      ),
    },
  ]

  return (
    <div>
      <DataTable
        title="Call Legs"
        ariaLabel="Call legs"
        rows={legs}
        columns={columns}
        getRowId={(leg) => leg.id}
        emptyMessage="No call legs recorded for this interaction."
        actions={legs.length > 0 ? <ZoneCaption /> : undefined}
        // Four columns of ids and timestamps in part of a row's width.
        minWidth="max-content"
      />
      {legs.length === 0 && (
        <PanelNote>
          Legs are written from dialer events, and the dialer&apos;s push carries no call id yet —
          so an empty table here is the expected answer, not a fault.
        </PanelNote>
      )}
    </div>
  )
}

const TRANSFER_TONE: Record<InteractionTransfer['status'], 'done' | 'caution' | 'red'> = {
  initiated: 'caution',
  offered: 'caution',
  accepted: 'done',
  rejected: 'red',
  timeout: 'red',
  failed: 'red',
}

const TRANSFER_LABEL: Record<InteractionTransfer['status'], string> = {
  initiated: 'Initiated',
  offered: 'Offered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  timeout: 'Timed out',
  failed: 'Failed',
}

/** A name, or what its absence means — never a bare id. */
function personCell(name: string | null, userId: string | null) {
  if (name) return name
  if (userId) return <span className="text-slate">Deleted account</span>
  return <span className="text-slate">None</span>
}

export function TransfersPanel({ transfers }: { transfers: InteractionTransfer[] }) {
  const columns: DataColumn<InteractionTransfer>[] = [
    {
      id: 'status',
      header: 'Status',
      render: (row) => <Badge tone={TRANSFER_TONE[row.status]}>{TRANSFER_LABEL[row.status]}</Badge>,
    },
    {
      id: 'fronter',
      header: 'Fronter',
      render: (row) => personCell(row.fronter_name, row.fronter_user_id),
    },
    {
      id: 'closer',
      header: 'Closer',
      render: (row) => personCell(row.closer_name, row.closer_user_id),
    },
  ]

  return (
    <DataTable
      title="Transfer"
      ariaLabel="Transfers"
      rows={transfers}
      columns={columns}
      getRowId={(row) => row.id}
      // Every attempt is listed, not just the last: a rejected or timed-out
      // transfer releases the interaction to be tried again.
      emptyMessage="No transfer was ever attempted on this interaction."
    />
  )
}

/** The design's rows, in its order and its wording. */
const SNAPSHOT_ROWS: { key: string; label: string }[] = [
  { key: 'mileage', label: 'Mileage:' },
  { key: 'state', label: 'State:' },
  { key: 'warranty_status', label: 'Warranty Status:' },
]

/**
 * The design asks for one Vehicle line; the snapshot may hold it as one key or
 * as year, make and model separately. Whichever keys it used are reported back,
 * so they are not then listed a second time below.
 */
function vehicleLine(snapshot: QualificationRecord['snapshot_json']): {
  value: unknown
  used: string[]
} {
  if (typeof snapshot.vehicle === 'string' && snapshot.vehicle) {
    return { value: snapshot.vehicle, used: ['vehicle'] }
  }

  const parts = ['vehicle_year', 'vehicle_make', 'vehicle_model'].filter((key) => {
    const value = snapshot[key]
    return (typeof value === 'string' && value) || typeof value === 'number'
  })
  if (parts.length === 0) return { value: null, used: ['vehicle'] }

  return { value: parts.map((key) => String(snapshot[key])).join(' '), used: ['vehicle', ...parts] }
}

/** Whatever is in the JSON, readable — objects as JSON rather than "[object Object]". */
function snapshotValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return NOT_RECORDED
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return (
    <pre className="whitespace-pre-wrap font-mono text-xs text-ink">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function SnapshotRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[16rem_1fr] sm:gap-x-6">
      <dt className="text-sm leading-[150%] text-body-text">{label}</dt>
      <dd className="text-base font-medium leading-[150%] text-ink">{children}</dd>
    </div>
  )
}

/**
 * One line for consent, as the design asks.
 *
 * A DNC flag outranks consent: it is a compliance stop, and reading
 * "Confirmed" on a flagged record would be the worst possible answer here.
 */
function consentLine(consent: QualificationRecord['consent_dnc']): ReactNode {
  if (consent.dnc_flagged) {
    return (
      <Badge tone="red">
        Do Not Call{consent.dnc_source ? ` · ${consent.dnc_source}` : ''}
      </Badge>
    )
  }
  if (!consent.consent_given) return <span className="text-slate">Not confirmed</span>
  return 'Confirmed'
}

function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="mb-5 border-b-hairline border-light-grey pb-4 text-lg font-medium leading-[120%] text-ink">
        {title}
      </h2>
      {children}
    </div>
  )
}

export function QualificationPanel({ record }: { record: QualificationRecord | null }) {
  if (!record) {
    return (
      <PanelShell title="Qualification Snapshot">
        <p className="py-10 text-center text-sm text-slate">
          No qualification was ever saved for this interaction.
        </p>
      </PanelShell>
    )
  }

  const snapshot = record.snapshot_json
  const vehicle = vehicleLine(snapshot)
  const named = new Set([...SNAPSHOT_ROWS.map((row) => row.key), 'notes', ...vehicle.used])
  // Listed rather than dropped: snapshot_json is free-form, and a screen for
  // auditing a record should not decide half of it is not worth showing.
  const extras = Object.keys(snapshot).filter((key) => !named.has(key))

  return (
    <PanelShell title="Qualification Snapshot">
      <dl className="space-y-3">
        <SnapshotRow label="Vehicle Year / Make / Model :">{snapshotValue(vehicle.value)}</SnapshotRow>

        {SNAPSHOT_ROWS.map((row) => (
          <SnapshotRow key={row.key} label={row.label}>
            {snapshotValue(snapshot[row.key])}
          </SnapshotRow>
        ))}

        <SnapshotRow label="Consent / DNC confirmation:">{consentLine(record.consent_dnc)}</SnapshotRow>
        <SnapshotRow label="Notes:">{snapshotValue(snapshot.notes)}</SnapshotRow>

        {extras.map((key) => (
          <SnapshotRow key={key} label={`${key}:`}>
            {snapshotValue(snapshot[key])}
          </SnapshotRow>
        ))}
      </dl>
    </PanelShell>
  )
}

/** Ties the event name to the payload it opens, for a reader who can't see it. */
const payloadId = (eventId: string) => `event-payload-${eventId}`

/** What the dialer called this event, falling back to the id it arrived with. */
function eventName(event: InteractionEvent): string {
  for (const key of ['event', 'event_type', 'type']) {
    const value = event.payload[key]
    if (typeof value === 'string' && value) return value
  }
  return event.event_id ?? 'Unnamed event'
}

/** Only where the event did not simply apply — an audit screen must not hide that. */
function eventTrouble(event: InteractionEvent): ReactNode {
  if (event.error) return <Badge tone="red">Failed</Badge>
  if (event.skipped_reason) return <Badge tone="neutral">Skipped</Badge>
  if (!event.processed_at) return <Badge tone="caution">Queued</Badge>
  return null
}

export function RawEventLogPanel({
  page,
  expandedId,
  onToggle,
  onOffsetChange,
}: {
  page: InteractionEventList
  expandedId: string | null
  onToggle: (id: string) => void
  onOffsetChange: (offset: number) => void
}) {
  const columns: DataColumn<InteractionEvent>[] = [
    {
      id: 'received',
      header: <OneLine>Time Stamp</OneLine>,
      render: (event) => <OneLine>{formatDateTime(event.received_at)}</OneLine>,
    },
    {
      id: 'event',
      header: 'Event',
      // The design has no actions column, so the event name is the control:
      // the payload is the reason to open a raw log at all.
      render: (event) => {
        const open = event.id === expandedId
        return (
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={open ? payloadId(event.id) : undefined}
              onClick={() => onToggle(event.id)}
              className="font-medium text-navy underline hover:text-black"
            >
              {eventName(event)}
              <span className="sr-only"> — show payload</span>
            </button>
            {eventTrouble(event)}
          </span>
        )
      },
    },
    { id: 'source', header: 'Source', render: (event) => event.source },
  ]

  return (
    <div>
      <DataTable
        title="Raw Event Log"
        ariaLabel="Raw event log"
        rows={page.items}
        columns={columns}
        getRowId={(event) => event.id}
        emptyMessage="No events are linked to this interaction."
        actions={page.total > 0 ? <ZoneCaption /> : undefined}
        paging={{
          total: page.total,
          limit: page.limit,
          offset: page.offset,
          onOffsetChange,
        }}
        expandedRowId={expandedId}
        renderExpanded={(event) => (
          <div id={payloadId(event.id)} className="space-y-2 py-1">
            {event.error && <p className="text-sm text-status-red">{event.error}</p>}
            {event.skipped_reason && (
              <p className="text-sm text-slate">Skipped: {event.skipped_reason}</p>
            )}
            <pre className="overflow-x-auto rounded-lg bg-shop-floor p-3 font-mono text-xs text-ink">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>
        )}
      />
      {page.total === 0 && (
        <PanelNote>
          An empty log means no events were recorded against this interaction, never that none
          arrived — events applied before the link existed carry no interaction id.
        </PanelNote>
      )}
    </div>
  )
}
