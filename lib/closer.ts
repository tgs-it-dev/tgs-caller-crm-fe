import type { components } from '@/lib/generated/schema'
import { AuthError } from '@/lib/auth'
import {
  captureDisposition,
  listDispositions,
  listInteractionDispositions,
  type DispositionCaptureRequest,
  type DispositionResponse,
  type InteractionDispositionResponse,
} from '@/lib/dispositions'
import {
  formatDispositionTime,
  type TodaysStatsResponse,
} from '@/lib/fronterStats'
import { getLatestQualification, type QualificationResponse } from '@/lib/qualification'
import {
  acceptTransfer,
  getTransfer,
  isPendingTransfer,
  type TransferResponse,
} from '@/lib/transfers'

export type { DispositionResponse, DispositionCaptureRequest, InteractionDispositionResponse }
export type { TransferResponse }
export type ConsentDnc = components['schemas']['ConsentDnc']

/**
 * Closer-facing read model for the Qualification Snapshot card.
 * Backed by `QualificationResponse.snapshot_json` + `consent_dnc` once the
 * fronter saves; keys below mirror the Figma labels until BE freezes a
 * dedicated closer DTO.
 */
export type CloserQualificationSnapshot = {
  vehicle: string
  mileage: string
  state: string
  warranty_status: string
  consent_label: string
  notes: string
}

/**
 * Row for Today's Disposition on closer Active Call.
 * Built from `GET /me/stats/today?stage=closer` — dispositions plus answered
 * transfers that may not have a closer disposition yet.
 */
export type TodaysDispositionRow = {
  interaction_id: string
  /** Lead display name (phone stand-in until leads carry names). */
  from_name: string
  /** Disposition time clock when known; answered-but-undispositioned rows omit it. */
  accepted_at: string | null
  disposition_label: string | null
}

export type CloserWorkspaceData = {
  transfer: TransferResponse
  qualification: QualificationResponse | null
  options: DispositionResponse[]
  captured: InteractionDispositionResponse[]
}

const DEFAULT_INTERACTION_ID = 'int-1001'

/** MSW desk seed helper — not used against the live API. */
export function transferIdForInteraction(interactionId: string) {
  return `transfer-for-${interactionId}`
}

export const CLOSER_DEFAULT_INTERACTION_ID = DEFAULT_INTERACTION_ID
export const CLOSER_DEFAULT_TRANSFER_ID = transferIdForInteraction(DEFAULT_INTERACTION_ID)

/** Workspace URL; `transferId` is required to accept/load against the real API. */
export function closerWorkspaceHref(interactionId: string, transferId?: string | null): string {
  const base = `/closer/workspace/${encodeURIComponent(interactionId)}`
  if (!transferId) return base
  return `${base}?transferId=${encodeURIComponent(transferId)}`
}

/** Seeded snapshot matching the Figma Closer Active Call frame. */
export const MOCK_CLOSER_SNAPSHOT: CloserQualificationSnapshot = {
  vehicle: '2019 Toyota Camry',
  mileage: '62,400',
  state: 'TX',
  warranty_status: 'Expired',
  consent_label: 'Confirmed',
  notes: 'Customer mentioned transmission noise',
}

/** Desk rows that MSW must also seed (qualification + accepted transfer). */
export type CloserDeskSeed = {
  interaction_id: string
  transfer_id: string
  from_name: string
  /** Minutes after 14:22:07 used for the Today's Disposition clock. */
  accepted_offset_min: number
  snapshot: CloserQualificationSnapshot
  consent_given: boolean
  dnc_flagged: boolean
}

export const CLOSER_DESK_SEEDS: readonly CloserDeskSeed[] = [
  {
    interaction_id: DEFAULT_INTERACTION_ID,
    transfer_id: CLOSER_DEFAULT_TRANSFER_ID,
    from_name: 'Jane D.',
    accepted_offset_min: 0,
    snapshot: MOCK_CLOSER_SNAPSHOT,
    consent_given: true,
    dnc_flagged: false,
  },
  {
    interaction_id: 'int-1102',
    transfer_id: transferIdForInteraction('int-1102'),
    from_name: 'Alex R.',
    accepted_offset_min: 1,
    snapshot: {
      vehicle: '2021 Honda Accord',
      mileage: '38,200',
      state: 'CA',
      warranty_status: 'Active',
      consent_label: 'Confirmed',
      notes: 'Interested in bumper-to-bumper extension',
    },
    consent_given: true,
    dnc_flagged: false,
  },
  {
    interaction_id: 'int-1103',
    transfer_id: transferIdForInteraction('int-1103'),
    from_name: 'Priya S.',
    accepted_offset_min: 2,
    snapshot: {
      vehicle: '2016 Ford F-150',
      mileage: '94,800',
      state: 'FL',
      warranty_status: 'Expired',
      consent_label: 'Not confirmed',
      notes: 'Caller asked about powertrain coverage only',
    },
    consent_given: false,
    dnc_flagged: false,
  },
]

/**
 * Map closer today stats onto the Active Call table.
 * Prefer answered transfers; overlay disposition label/time/lead when present.
 */
export function closerTodaysRowsFromStats(payload: TodaysStatsResponse): TodaysDispositionRow[] {
  const byInteraction = new Map(
    payload.dispositions.map((row) => [row.interaction_id, row] as const)
  )

  const orderedIds: string[] = []
  const seen = new Set<string>()
  for (const id of [
    ...payload.transferred_interaction_ids,
    ...payload.dispositions.map((row) => row.interaction_id),
  ]) {
    if (seen.has(id)) continue
    seen.add(id)
    orderedIds.push(id)
  }

  return orderedIds.map((interaction_id) => {
    const disposition = byInteraction.get(interaction_id)
    return {
      interaction_id,
      from_name: disposition?.lead_name ?? interaction_id.slice(0, 8),
      accepted_at: disposition ? formatDispositionTime(disposition.created_at) : null,
      disposition_label: disposition?.label ?? null,
    }
  })
}

function snapString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function vehicleFromSnap(snap: Record<string, unknown>): string {
  const combined = snapString(snap.vehicle)
  if (combined.trim()) return combined
  return [snap.vehicle_year, snap.vehicle_make, snap.vehicle_model]
    .map(snapString)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

export function snapshotFromQualification(
  qualification: QualificationResponse | null
): CloserQualificationSnapshot | null {
  if (!qualification) return null

  const snap = qualification.snapshot_json as Record<string, unknown>
  const consent = qualification.consent_dnc
  const consent_label = consent.dnc_flagged
    ? 'DNC flagged'
    : consent.consent_given
      ? 'Confirmed'
      : 'Not confirmed'

  return {
    vehicle: vehicleFromSnap(snap),
    mileage: snapString(snap.mileage),
    state: snapString(snap.state),
    warranty_status: snapString(snap.warranty_status),
    consent_label,
    notes: snapString(snap.notes),
  }
}

/** Latest closer-stage capture for an interaction, if any. */
export function latestCloserDisposition(
  items: InteractionDispositionResponse[]
): InteractionDispositionResponse | null {
  const closer = items.filter((item) => item.stage === 'closer')
  if (closer.length === 0) return null
  return closer.reduce((best, item) => (item.version > best.version ? item : best))
}

/**
 * Accept a pending transfer when needed, then load qualification + dispositions.
 * Coalesces concurrent loads (Strict Mode remount) for the same transfer.
 */
const inflightByTransfer = new Map<string, Promise<CloserWorkspaceData>>()

export function loadCloserWorkspace(
  opts: { interactionId: string; transferId: string; closerUserId: string },
  token: string
): Promise<CloserWorkspaceData> {
  const key = `${opts.transferId}:${opts.closerUserId}`
  let inflight = inflightByTransfer.get(key)
  if (!inflight) {
    inflight = resolveCloserWorkspace(opts, token).finally(() => {
      if (inflightByTransfer.get(key) === inflight) {
        inflightByTransfer.delete(key)
      }
    })
    inflightByTransfer.set(key, inflight)
  }
  return inflight
}

async function resolveCloserWorkspace(
  opts: { interactionId: string; transferId: string; closerUserId: string },
  token: string
): Promise<CloserWorkspaceData> {
  let transfer = await getTransfer(opts.transferId, token)
  if (!transfer) {
    throw new AuthError('No transfer found for this interaction.', 404, 'transfer.not_found')
  }
  if (transfer.interaction_id !== opts.interactionId) {
    throw new AuthError(
      'This transfer does not belong to the requested interaction.',
      422,
      'transfer.interaction_mismatch'
    )
  }

  if (isPendingTransfer(transfer.status)) {
    try {
      transfer = await acceptTransfer(
        opts.transferId,
        { closer_user_id: opts.closerUserId },
        token
      )
    } catch (err) {
      // Two tabs / Strict Mode: offer already answered — refetch.
      if (err instanceof AuthError && err.code === 'transfer.not_answerable') {
        const again = await getTransfer(opts.transferId, token)
        if (again?.status === 'accepted') {
          transfer = again
        } else {
          throw err
        }
      } else {
        throw err
      }
    }
  } else if (transfer.status !== 'accepted') {
    throw new AuthError(
      `This transfer is ${transfer.status} and cannot be opened.`,
      409,
      'transfer.not_answerable'
    )
  }

  const [qualification, options, captured] = await Promise.all([
    getLatestQualification(opts.interactionId, token),
    listDispositions(token, 'closer'),
    listInteractionDispositions(opts.interactionId, token),
  ])

  return { transfer, qualification, options, captured }
}

export async function createCloserDisposition(
  interactionId: string,
  payload: DispositionCaptureRequest,
  token: string
): Promise<InteractionDispositionResponse> {
  return captureDisposition(interactionId, payload, token)
}

export async function listCloserDispositionOptions(
  token: string
): Promise<DispositionResponse[]> {
  return listDispositions(token, 'closer')
}

export { listInteractionDispositions, getLatestQualification }
