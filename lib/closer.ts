import type { components } from '@/lib/generated/schema'

export type QualificationResponse = components['schemas']['QualificationResponse']
export type TransferResponse = components['schemas']['TransferResponse']
export type ConsentDnc = components['schemas']['ConsentDnc']
export type DispositionResponse = components['schemas']['DispositionResponse']
export type DispositionCaptureRequest = components['schemas']['DispositionCaptureRequest']
export type InteractionDispositionResponse =
  components['schemas']['InteractionDispositionResponse']

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

/** Row for Today's Disposition — accepted transfers on the closer desk. */
export type TodaysDispositionRow = {
  transfer_id: TransferResponse['id']
  interaction_id: TransferResponse['interaction_id']
  status: TransferResponse['status']
  from_name: string
  accepted_at: string
  /** Latest closer-stage disposition label when one has been captured. */
  disposition_label: string | null
}

const DEFAULT_INTERACTION_ID = 'int-1001'

export function transferIdForInteraction(interactionId: string) {
  return `transfer-for-${interactionId}`
}

export const CLOSER_DEFAULT_INTERACTION_ID = DEFAULT_INTERACTION_ID
export const CLOSER_DEFAULT_TRANSFER_ID = transferIdForInteraction(DEFAULT_INTERACTION_ID)

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

function formatAcceptedClock(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Today's accepted transfers for the closer desk (mock until a list endpoint ships). */
export function listTodaysDispositions(
  dispositionByInteraction: Record<string, string | null> = {}
): TodaysDispositionRow[] {
  const base = new Date()
  base.setHours(14, 22, 7, 0)

  return CLOSER_DESK_SEEDS.map((seed) => {
    const accepted = new Date(base.getTime() + seed.accepted_offset_min * 60_000)
    return {
      transfer_id: seed.transfer_id,
      interaction_id: seed.interaction_id,
      status: 'accepted' as const,
      from_name: seed.from_name,
      accepted_at: formatAcceptedClock(accepted.toISOString()),
      disposition_label: dispositionByInteraction[seed.interaction_id] ?? null,
    }
  })
}

function snapString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function snapshotFromQualification(
  qualification: QualificationResponse | null
): CloserQualificationSnapshot | null {
  if (!qualification) return null

  const snap = qualification.snapshot_json
  const consent = qualification.consent_dnc
  const consent_label = consent.dnc_flagged
    ? 'DNC flagged'
    : consent.consent_given
      ? 'Confirmed'
      : 'Not confirmed'

  return {
    vehicle: snapString(snap.vehicle),
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

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  return `${base}${path}`
}

class CloserApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'CloserApiError'
    this.status = status
  }
}

type AuthJsonInit = RequestInit & {
  errorMessage?: string
}

async function authJson<T>(path: string, token: string, init: AuthJsonInit = {}): Promise<T> {
  const { errorMessage, headers, ...rest } = init
  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  })
  if (!res.ok) {
    throw new CloserApiError(
      res.status,
      errorMessage ?? `Request failed (${res.status}) for ${path}`
    )
  }
  return res.json() as Promise<T>
}

async function authJsonOrNull<T>(
  path: string,
  token: string,
  init: AuthJsonInit = {}
): Promise<T | null> {
  try {
    return await authJson<T>(path, token, init)
  } catch (err) {
    if (err instanceof CloserApiError && err.status === 404) return null
    throw err
  }
}

export async function getLatestQualification(
  interactionId: string,
  token: string
): Promise<QualificationResponse | null> {
  return authJsonOrNull<QualificationResponse>(`/qualification/${interactionId}`, token, {
    errorMessage: 'Unable to load the qualification snapshot.',
  })
}

export async function getTransfer(
  transferId: string,
  token: string
): Promise<TransferResponse | null> {
  return authJsonOrNull<TransferResponse>(`/transfers/${transferId}`, token, {
    errorMessage: 'Unable to load the transfer.',
  })
}

export async function listCloserDispositionOptions(
  token: string
): Promise<DispositionResponse[]> {
  const data = await authJson<{ items: DispositionResponse[] }>(
    '/dispositions?stage=closer',
    token
  )
  return data.items
}

export async function listInteractionDispositions(
  interactionId: string,
  token: string
): Promise<InteractionDispositionResponse[]> {
  const data = await authJson<{ items: InteractionDispositionResponse[] }>(
    `/interactions/${interactionId}/dispositions`,
    token
  )
  return data.items
}

export async function createCloserDisposition(
  interactionId: string,
  payload: DispositionCaptureRequest,
  token: string
): Promise<InteractionDispositionResponse> {
  return authJson<InteractionDispositionResponse>(
    `/interactions/${interactionId}/dispositions`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      errorMessage: 'Unable to save the disposition.',
    }
  )
}

// Accept/reject offer client helpers are out of scope for FE-03 / Screen 6
// (workspace assumes an already-accepted transfer). Reintroduce when the
// closer-offer UI ships.
