'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import {
  latestCloserDisposition,
  latestFronterDisposition,
  type InteractionDispositionResponse,
} from '@/lib/dispositions'
import { formatDateTime, formatPhone, localZoneName } from '@/lib/format'
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
      // A status and two names, none of which reads if it is broken across
      // lines. Without this the table is laid out fixed, splitting whatever
      // width the card has into three and clipping the badge.
      minWidth="max-content"
      // Every attempt is listed, not just the last: a rejected or timed-out
      // transfer releases the interaction to be tried again.
      emptyMessage="No transfer was ever attempted on this interaction."
    />
  )
}

/** Dropped from the closer/admin card — no longer shown as named rows or extras. */
const HIDDEN_SNAPSHOT_KEYS = new Set([
  'mileage',
  'state',
  'warranty_status',
  'notes',
  'vehicle',
  'vehicle_year',
  'vehicle_make',
  'vehicle_model',
  'vin',
  'license_plate',
  'checklist',
  'disposition',
  'override',
])

function preferField(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text && text.toLowerCase() !== 'not provided') return text
  }
  return ''
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

function SnapshotSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b-hairline border-light-grey pb-2 text-base font-semibold leading-[120%] text-ink">
        {title}
      </h3>
      {children}
    </section>
  )
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

type AgentDispositionRow = {
  id: 'fronter' | 'closer'
  role: string
  name: string | null
  userId: string | null
  disposition: string | null
  /** When the latest disposition for this stage was written; null if none. */
  recordedAt: string | null
}

/**
 * Name for a stage's latest disposition actor.
 *
 * Disposition rows only carry `actor_user_id`; transfer items already resolve
 * names for the same people, so join on that id. When there is no disposition
 * yet, fall back to the most recent transfer party for the stage.
 */
function partyForStage(
  stage: 'fronter' | 'closer',
  actorUserId: string | null,
  transfers: InteractionTransfer[]
): { name: string | null; userId: string | null } {
  const idKey = stage === 'fronter' ? 'fronter_user_id' : 'closer_user_id'
  const nameKey = stage === 'fronter' ? 'fronter_name' : 'closer_name'

  if (actorUserId) {
    const match = transfers.find((row) => row[idKey] === actorUserId)
    return { name: match?.[nameKey] ?? null, userId: actorUserId }
  }

  for (let index = transfers.length - 1; index >= 0; index -= 1) {
    const row = transfers[index]
    if (row[idKey]) return { name: row[nameKey], userId: row[idKey] }
  }
  return { name: null, userId: null }
}

/**
 * Fronter and closer — name plus latest disposition — above Qualification
 * Snapshot. Same DataTable chrome as Call Legs / Transfer.
 */
export function DispositionsPanel({
  items,
  transfers,
}: {
  items: InteractionDispositionResponse[]
  transfers: InteractionTransfer[]
}) {
  const fronter = latestFronterDisposition(items)
  const closer = latestCloserDisposition(items)

  const rows: AgentDispositionRow[] = [
    {
      id: 'fronter',
      role: 'Fronter',
      ...partyForStage('fronter', fronter?.actor_user_id ?? null, transfers),
      disposition: fronter?.label ?? null,
      recordedAt: fronter?.created_at ?? null,
    },
    {
      id: 'closer',
      role: 'Closer',
      ...partyForStage('closer', closer?.actor_user_id ?? null, transfers),
      disposition: closer?.label ?? null,
      recordedAt: closer?.created_at ?? null,
    },
  ]

  const columns: DataColumn<AgentDispositionRow>[] = [
    { id: 'role', header: 'Role', render: (row) => row.role },
    {
      id: 'name',
      header: 'Name',
      // Names come from the transfer join; without one, dash — never invent
      // "Deleted account" the way Transfer does, because a disposition actor
      // may simply never have been on a transfer row.
      render: (row) => row.name ?? <span className="text-slate">—</span>,
    },
    {
      id: 'disposition',
      header: 'Disposition',
      render: (row) => row.disposition ?? <span className="text-slate">—</span>,
    },
    {
      id: 'recorded',
      header: 'Recorded at',
      render: (row) => (
        <OneLine>
          {row.recordedAt ? formatDateTime(row.recordedAt) : <span className="text-slate">—</span>}
        </OneLine>
      ),
    },
  ]

  const anyRecorded = rows.some((row) => row.recordedAt)

  return (
    <DataTable
      title="Dispositions"
      ariaLabel="Fronter and closer dispositions"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      emptyMessage="No dispositions recorded for this interaction."
      actions={anyRecorded ? <ZoneCaption /> : undefined}
      minWidth="max-content"
    />
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
  const customer = record.customer
  // Listed rather than dropped: snapshot_json is free-form, and a screen for
  // auditing a record should not decide half of it is not worth showing —
  // except the fields the product has retired from this card.
  const extras = Object.keys(snapshot).filter((key) => !HIDDEN_SNAPSHOT_KEYS.has(key))

  const firstName = preferField(customer?.first_name)
  const lastName = preferField(customer?.last_name)
  const phone = preferField(customer?.phone_no)
  const year = preferField(customer?.vehicle_year, snapshot.vehicle_year)
  const make = preferField(customer?.vehicle_make, snapshot.vehicle_make)
  const model = preferField(customer?.vehicle_model, snapshot.vehicle_model)
  const vin = preferField(customer?.vin, snapshot.vin)
  const plate = preferField(customer?.license_plate, snapshot.license_plate)

  return (
    <PanelShell title="Qualification Snapshot">
      <div className="space-y-6">
        <SnapshotSection title="Personal">
          <dl className="space-y-3">
            <SnapshotRow label="First name:">{snapshotValue(firstName)}</SnapshotRow>
            <SnapshotRow label="Last name:">{snapshotValue(lastName)}</SnapshotRow>
            <SnapshotRow label="Phone:">{snapshotValue(phone ? formatPhone(phone) : '')}</SnapshotRow>
          </dl>
        </SnapshotSection>

        <SnapshotSection title="Vehicle">
          <dl className="space-y-3">
            <SnapshotRow label="Make:">{snapshotValue(make)}</SnapshotRow>
            <SnapshotRow label="Model:">{snapshotValue(model)}</SnapshotRow>
            <SnapshotRow label="Year:">{snapshotValue(year)}</SnapshotRow>
          </dl>
        </SnapshotSection>

        <SnapshotSection title="Identity">
          <dl className="space-y-3">
            <SnapshotRow label="VIN:">{snapshotValue(vin)}</SnapshotRow>
            <SnapshotRow label="License plate:">{snapshotValue(plate)}</SnapshotRow>
          </dl>
        </SnapshotSection>

        {extras.length > 0 && (
          <SnapshotSection title="Other">
            <dl className="space-y-3">
              {extras.map((key) => (
                <SnapshotRow key={key} label={`${key}:`}>
                  {snapshotValue(snapshot[key])}
                </SnapshotRow>
              ))}
            </dl>
          </SnapshotSection>
        )}
      </div>
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
