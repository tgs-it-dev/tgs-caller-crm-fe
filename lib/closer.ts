import type { components } from '@/lib/generated/schema'

export type QualificationResponse = components['schemas']['QualificationResponse']
export type TransferResponse = components['schemas']['TransferResponse']
export type TransferDecisionRequest = components['schemas']['TransferDecisionRequest']
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
export const CLOSER_DEFAULT_TRANSFER_ID = `transfer-for-${DEFAULT_INTERACTION_ID}`

/** Seeded snapshot matching the Figma Closer Active Call frame. */
export const MOCK_CLOSER_SNAPSHOT: CloserQualificationSnapshot = {
  vehicle: '2019 Toyota Camry',
  mileage: '62,400',
  state: 'TX',
  warranty_status: 'Expired',
  consent_label: 'Confirmed',
  notes: 'Customer mentioned transmission noise',
}

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

  return Array.from({ length: 48 }, (_, i) => {
    const accepted = new Date(base.getTime() + i * 60_000)
    const interaction_id =
      i === 0 ? DEFAULT_INTERACTION_ID : `int-today-${String(i + 1).padStart(4, '0')}`
    return {
      transfer_id: `transfer-today-${i + 1}`,
      interaction_id,
      status: 'accepted' as const,
      from_name: i % 2 === 0 ? 'Jane D.' : 'Alex R.',
      accepted_at: formatAcceptedClock(accepted.toISOString()),
      disposition_label: dispositionByInteraction[interaction_id] ?? null,
    }
  })
}

export function snapshotFromQualification(
  qualification: QualificationResponse | null
): CloserQualificationSnapshot {
  if (!qualification) return MOCK_CLOSER_SNAPSHOT

  const snap = qualification.snapshot_json
  const vehicle = typeof snap.vehicle === 'string' ? snap.vehicle : MOCK_CLOSER_SNAPSHOT.vehicle
  const mileage = typeof snap.mileage === 'string' ? snap.mileage : MOCK_CLOSER_SNAPSHOT.mileage
  const state = typeof snap.state === 'string' ? snap.state : MOCK_CLOSER_SNAPSHOT.state
  const warranty =
    typeof snap.warranty_status === 'string'
      ? snap.warranty_status
      : MOCK_CLOSER_SNAPSHOT.warranty_status
  const notes = typeof snap.notes === 'string' ? snap.notes : MOCK_CLOSER_SNAPSHOT.notes

  const consent = qualification.consent_dnc
  const consent_label = consent.dnc_flagged
    ? 'DNC flagged'
    : consent.consent_given
      ? 'Confirmed'
      : 'Not confirmed'

  return { vehicle, mileage, state, warranty_status: warranty, consent_label, notes }
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

async function authJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`)
  }
  return res.json() as Promise<T>
}

export async function getLatestQualification(
  interactionId: string,
  token: string
): Promise<QualificationResponse | null> {
  const res = await fetch(apiUrl(`/qualification/${interactionId}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Unable to load the qualification snapshot.')
  return res.json() as Promise<QualificationResponse>
}

export async function getTransfer(
  transferId: string,
  token: string
): Promise<TransferResponse | null> {
  const res = await fetch(apiUrl(`/transfers/${transferId}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Unable to load the transfer.')
  return res.json() as Promise<TransferResponse>
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
  const res = await fetch(apiUrl(`/interactions/${interactionId}/dispositions`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Unable to save the disposition.')
  return res.json() as Promise<InteractionDispositionResponse>
}

export async function acceptTransfer(
  transferId: string,
  payload: TransferDecisionRequest,
  token: string
): Promise<TransferResponse> {
  const res = await fetch(apiUrl(`/transfers/${transferId}/accept`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Unable to accept the transfer.')
  return res.json() as Promise<TransferResponse>
}

export const CLOSER_DEFAULT_INTERACTION_ID = DEFAULT_INTERACTION_ID
