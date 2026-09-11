import type { components } from '@/lib/generated/schema'

export type QualificationResponse = components['schemas']['QualificationResponse']
export type TransferResponse = components['schemas']['TransferResponse']
export type TransferDecisionRequest = components['schemas']['TransferDecisionRequest']
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

/** Row for Today's Disposition — composes TransferResponse + display fields. */
export type TodaysDispositionRow = {
  transfer_id: TransferResponse['id']
  interaction_id: TransferResponse['interaction_id']
  status: TransferResponse['status']
  from_name: string
  accepted_at: string
}

const DEFAULT_INTERACTION_ID = 'int-1001'

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
export function listTodaysDispositions(): TodaysDispositionRow[] {
  const base = new Date()
  base.setHours(14, 22, 7, 0)

  return Array.from({ length: 48 }, (_, i) => {
    const accepted = new Date(base.getTime() + i * 60_000)
    return {
      transfer_id: `transfer-today-${i + 1}`,
      interaction_id: i === 0 ? DEFAULT_INTERACTION_ID : `int-today-${String(i + 1).padStart(4, '0')}`,
      status: 'accepted' as const,
      from_name: i % 2 === 0 ? 'Jane D.' : 'Alex R.',
      accepted_at: formatAcceptedClock(accepted.toISOString()),
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

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  return `${base}${path}`
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
