import type { components } from '@/lib/generated/schema'
import { AuthError } from '@/lib/auth'
import {
  captureDisposition,
  getInteractionDispositions,
  listDispositions,
  listInteractionDispositions,
  type DispositionCaptureRequest,
  type DispositionResponse,
  type InteractionDispositionList,
  type InteractionDispositionResponse,
} from '@/lib/dispositions'
import { type TodaysStatsResponse } from '@/lib/fronterStats'
import { getInteractionDetailResponse } from '@/lib/interactions'
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
 * Closer-facing read model for the Lead Details card.
 * Prefer `QualificationResponse.customer` (lead fields); fall back to
 * `snapshot_json` vehicle_* for older saves that predate the customer block.
 */
export type CloserQualificationSnapshot = {
  first_name: string
  last_name: string
  phone_no: string
  vehicle_year: string
  vehicle_make: string
  vehicle_model: string
  vin: string
  license_plate: string
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
  /** Disposition time as ISO; the table formats it for display. */
  accepted_at: string | null
  disposition_label: string | null
}

/** Whether the call is closed to its closer, and the callback request behind it. */
export type CallStanding = Pick<InteractionDispositionList, 'locked' | 'callback_status'>

export type CloserWorkspaceData = {
  /** Null on a call the closer started as an Own Sale. */
  transfer: TransferResponse | null
  ownSale: boolean
  /** When the closer took the call: the accept, or the Own Sale start. */
  startedAt: string | null
  qualification: QualificationResponse | null
  options: DispositionResponse[]
  captured: InteractionDispositionResponse[]
  standing: CallStanding
}

/** Where a call closed to its closer stands: a badge and one line, in their words. */
export type ClosedCall = {
  badge: string
  tone: 'amber' | 'red' | 'neutral'
  message: string
}

/** Null while the call is open to its closer. */
export function closedCall(standing: CallStanding): ClosedCall | null {
  if (!standing.locked) return null
  if (standing.callback_status === 'pending') {
    return {
      badge: 'Waiting for approval',
      tone: 'amber',
      message: 'It opens from your Callbacks once a Super Admin approves it.',
    }
  }
  if (standing.callback_status === 'rejected') {
    return {
      badge: 'Rejected',
      tone: 'red',
      message: 'A Super Admin rejected it, so the call stays closed.',
    }
  }
  return {
    badge: 'Closed',
    tone: 'neutral',
    message: "The call is closed, so the outcome and cart can't change.",
  }
}

/** Nothing was handed over on an Own Sale call, so this outcome is left out there. */
export const TRANSFER_DROPPED_LABEL = 'Transfer Dropped'

const DEFAULT_INTERACTION_ID = 'int-1001'

/** MSW desk seed helper — not used against the live API. */
export function transferIdForInteraction(interactionId: string) {
  return `transfer-for-${interactionId}`
}

export const CLOSER_DEFAULT_INTERACTION_ID = DEFAULT_INTERACTION_ID
export const CLOSER_DEFAULT_TRANSFER_ID = transferIdForInteraction(DEFAULT_INTERACTION_ID)

/**
 * Workspace URL. Query params (not a path segment) so static export / S3 can
 * soft-navigate without pre-rendering every interaction id.
 * `transferId` accepts and loads a handed-over call; without it the call must be
 * one the closer started as an Own Sale.
 */
export function closerWorkspaceHref(interactionId: string, transferId?: string | null): string {
  const params = new URLSearchParams({ id: interactionId })
  if (transferId) params.set('transferId', transferId)
  return `/closer/workspace/?${params.toString()}`
}

/** Seeded snapshot matching the closer Lead Details card. */
export const MOCK_CLOSER_SNAPSHOT: CloserQualificationSnapshot = {
  first_name: 'Jane',
  last_name: 'D.',
  phone_no: '+13235550142',
  vehicle_year: '2019',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vin: '',
  license_plate: '',
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
      first_name: 'Alex',
      last_name: 'R.',
      phone_no: '+13105550188',
      vehicle_year: '2021',
      vehicle_make: 'Honda',
      vehicle_model: 'Accord',
      vin: '',
      license_plate: '',
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
      first_name: 'Priya',
      last_name: 'S.',
      phone_no: '+18135550177',
      vehicle_year: '2016',
      vehicle_make: 'Ford',
      vehicle_model: 'F-150',
      vin: '',
      license_plate: '',
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
      accepted_at: disposition?.created_at ?? null,
      disposition_label: disposition?.label ?? null,
    }
  })
}

function snapString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function prefer(...values: unknown[]): string {
  for (const value of values) {
    const text = snapString(value).trim()
    if (text && text.toLowerCase() !== 'not provided') return text
  }
  return ''
}

export function snapshotFromQualification(
  qualification: QualificationResponse | null
): CloserQualificationSnapshot | null {
  if (!qualification) return null

  const snap = qualification.snapshot_json as Record<string, unknown>
  const customer = qualification.customer

  return {
    first_name: prefer(customer?.first_name),
    last_name: prefer(customer?.last_name),
    phone_no: prefer(customer?.phone_no),
    vehicle_year: prefer(customer?.vehicle_year, snap.vehicle_year),
    vehicle_make: prefer(customer?.vehicle_make, snap.vehicle_make),
    vehicle_model: prefer(customer?.vehicle_model, snap.vehicle_model),
    vin: prefer(customer?.vin, snap.vin),
    license_plate: prefer(customer?.license_plate, snap.license_plate),
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
 * With no transfer, the call is one the closer started as an Own Sale.
 * Coalesces concurrent loads (Strict Mode remount) for the same transfer.
 */
const inflightByTransfer = new Map<string, Promise<CloserWorkspaceData>>()

type WorkspaceOpts = { interactionId: string; transferId: string | null; closerUserId: string }

export function loadCloserWorkspace(
  opts: WorkspaceOpts,
  token: string
): Promise<CloserWorkspaceData> {
  const key = `${opts.transferId ?? opts.interactionId}:${opts.closerUserId}`
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

async function loadCall(interactionId: string, token: string) {
  const [qualification, options, list] = await Promise.all([
    getLatestQualification(interactionId, token),
    listDispositions(token, 'closer'),
    getInteractionDispositions(interactionId, token),
  ])
  return {
    qualification,
    options,
    captured: list.items,
    standing: { locked: list.locked, callback_status: list.callback_status },
  }
}

async function resolveOwnSaleWorkspace(
  interactionId: string,
  token: string
): Promise<CloserWorkspaceData> {
  const detail = await getInteractionDetailResponse(interactionId, token)
  if (!detail.own_sale) {
    throw new AuthError(
      'No active transfer for this call. Open it from the Queue.',
      404,
      'transfer.not_found'
    )
  }
  const call = await loadCall(interactionId, token)
  return {
    ...call,
    transfer: null,
    ownSale: true,
    startedAt: detail.created_at,
    options: call.options.filter((option) => option.label !== TRANSFER_DROPPED_LABEL),
  }
}

async function resolveCloserWorkspace(
  opts: WorkspaceOpts,
  token: string
): Promise<CloserWorkspaceData> {
  if (!opts.transferId) return resolveOwnSaleWorkspace(opts.interactionId, token)
  const transferId = opts.transferId
  let transfer = await getTransfer(transferId, token)
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
        transferId,
        { closer_user_id: opts.closerUserId },
        token
      )
    } catch (err) {
      // Two tabs / Strict Mode: offer already answered — refetch.
      if (err instanceof AuthError && err.code === 'transfer.not_answerable') {
        const again = await getTransfer(transferId, token)
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

  return {
    ...(await loadCall(opts.interactionId, token)),
    transfer,
    ownSale: false,
    startedAt: transfer.status === 'accepted' ? transfer.updated_at : null,
  }
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

export { getInteractionDispositions, listInteractionDispositions, getLatestQualification }
