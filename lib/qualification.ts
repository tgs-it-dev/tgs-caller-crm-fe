import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type LeadSource = components['schemas']['LeadResponse']['source']

export const CHECKLIST_ITEMS = [
  { key: 'identityVerified', label: "Verified the caller's identity" },
  { key: 'vehicleDetailsConfirmed', label: 'Confirmed vehicle year, make, and model' },
  { key: 'warrantyNeedConfirmed', label: 'Confirmed the warranty coverage need' },
  { key: 'budgetDiscussed', label: 'Discussed budget / payment expectations' },
  { key: 'decisionMakerConfirmed', label: 'Speaking with the decision-maker' },
] as const

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]['key']

export type ChecklistState = Record<ChecklistKey, boolean>

export const EMPTY_CHECKLIST: ChecklistState = {
  identityVerified: false,
  vehicleDetailsConfirmed: false,
  warrantyNeedConfirmed: false,
  budgetDiscussed: false,
  decisionMakerConfirmed: false,
}

/**
 * Outcomes still baked into the snapshot for the existing Workspace UI.
 * Prefer `GET /dispositions?stage=fronter` + `POST .../dispositions` when
 * wiring Active Call to the catalogue.
 */
export const DISPOSITIONS = [
  { value: 'qualified', label: 'Qualified — ready to transfer' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'callback_requested', label: 'Callback requested' },
  { value: 'do_not_call', label: 'Do not call' },
  { value: 'invalid_number', label: 'Invalid / wrong number' },
] as const

export type Disposition = (typeof DISPOSITIONS)[number]['value']

export type QualificationOverride = {
  applied: boolean
  reason: string
}

/** Existing Workspace snapshot. Transfer gate on BE also reads vehicle_* keys. */
export type QualificationSnapshot = {
  checklist: ChecklistState
  disposition: Disposition | null
  notes: string
  override: QualificationOverride
  vehicle_year?: string
  vehicle_make?: string
  vehicle_model?: string
  mileage?: string
  state?: string
  warranty_status?: string
}

export type ConsentDnc = components['schemas']['ConsentDnc']

export type QualificationResponse = {
  id: string
  interaction_id: string
  version: number
  snapshot_json: QualificationSnapshot
  consent_dnc: ConsentDnc
  created_at: string
  updated_at?: string
}

export type QualificationCreateRequest = {
  interaction_id: string
  /** Free-form dict — Active Call sends vehicle_*; Workspace may send checklist. */
  snapshot_json: QualificationSnapshot | Record<string, unknown>
  consent_dnc: ConsentDnc
}

/** BE transfer required fields (TransferRequiredField / seed). */
export const REQUIRED_TRANSFER_FIELDS = [
  'vehicle_year',
  'vehicle_make',
  'vehicle_model',
  'mileage',
] as const

export type RequiredTransferField = (typeof REQUIRED_TRANSFER_FIELDS)[number]

export function missingRequiredFields(
  snapshot: Pick<
    QualificationSnapshot,
    'vehicle_year' | 'vehicle_make' | 'vehicle_model' | 'mileage'
  >
): RequiredTransferField[] {
  return REQUIRED_TRANSFER_FIELDS.filter((key) => !String(snapshot[key] ?? '').trim())
}

/** Active Call Figma form — combined vehicle line maps to BE vehicle_* keys. */
export type ActiveCallForm = {
  vehicle: string
  mileage: string
  state: string
  warranty_status: string
  notes: string
  consent: 'yes' | 'no'
  /** Hard compliance stop — transfer must not bypass this. */
  dnc_flagged: boolean
  dnc_source: string | null
}

export const EMPTY_ACTIVE_CALL_FORM: ActiveCallForm = {
  vehicle: '',
  mileage: '',
  state: '',
  warranty_status: '',
  notes: '',
  consent: 'yes',
  dnc_flagged: false,
  dnc_source: null,
}

export const WARRANTY_STATUS_OPTIONS = ['Active', 'Expired', 'Expiring soon', 'Unknown'] as const

/** Split "2019 Toyota Camry" → year / make / model for the transfer gate. */
export function parseVehicleLine(vehicle: string): {
  vehicle_year: string
  vehicle_make: string
  vehicle_model: string
} {
  const parts = vehicle.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { vehicle_year: '', vehicle_make: '', vehicle_model: '' }
  const yearLike = /^\d{4}$/.test(parts[0] ?? '')
  if (yearLike) {
    return {
      vehicle_year: parts[0] ?? '',
      vehicle_make: parts[1] ?? '',
      vehicle_model: parts.slice(2).join(' '),
    }
  }
  return {
    vehicle_year: '',
    vehicle_make: parts[0] ?? '',
    vehicle_model: parts.slice(1).join(' '),
  }
}

export function snapshotJsonFromActiveCall(form: ActiveCallForm): Record<string, unknown> {
  const parsed = parseVehicleLine(form.vehicle)
  return {
    vehicle: form.vehicle.trim(),
    ...parsed,
    mileage: form.mileage.trim(),
    state: form.state.trim(),
    warranty_status: form.warranty_status,
    notes: form.notes,
  }
}

export function consentFromActiveCall(form: ActiveCallForm): ConsentDnc {
  const given = form.consent === 'yes'
  return {
    consent_given: given,
    consent_captured_at: given ? new Date().toISOString() : null,
    dnc_flagged: form.dnc_flagged,
    dnc_source: form.dnc_flagged
      ? form.dnc_source ?? 'fronter_active_call'
      : null,
  }
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/** Hydrate the Active Call form from a saved `snapshot_json` + consent. */
export function activeCallFormFromQualification(
  snapshot: Record<string, unknown> | null | undefined,
  consent: ConsentDnc | null | undefined
): ActiveCallForm {
  const vehicle =
    asString(snapshot?.vehicle) ||
    [snapshot?.vehicle_year, snapshot?.vehicle_make, snapshot?.vehicle_model]
      .map(asString)
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' ')

  return {
    vehicle,
    mileage: asString(snapshot?.mileage),
    state: asString(snapshot?.state),
    warranty_status: asString(snapshot?.warranty_status),
    notes: asString(snapshot?.notes),
    consent: consent?.consent_given ? 'yes' : consent ? 'no' : 'yes',
    dnc_flagged: consent?.dnc_flagged ?? false,
    dnc_source: consent?.dnc_source ?? null,
  }
}

export function missingActiveCallTransferFields(form: ActiveCallForm): RequiredTransferField[] {
  return missingRequiredFields({
    ...parseVehicleLine(form.vehicle),
    mileage: form.mileage,
  })
}

/** Client gate for the Transfer button on Active Call. */
export function canTransferActiveCall(
  form: ActiveCallForm,
  opts: { dispositionId: string; overrideReason: string }
): boolean {
  // Hard compliance stop — no override bypasses this (same as canTransfer).
  if (form.dnc_flagged) return false
  if (form.consent !== 'yes') return false
  if (!opts.dispositionId) return false
  const missing = missingActiveCallTransferFields(form)
  if (missing.length === 0) return true
  return opts.overrideReason.trim().length > 0
}

export async function getLatestQualification(
  interactionId: string,
  token: string
): Promise<QualificationResponse | null> {
  const res = await fetch(apiUrl(`/qualification/${interactionId}`), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 404) return null
  if (!res.ok) throw await authError(res)

  return res.json() as Promise<QualificationResponse>
}

export async function submitQualification(
  payload: QualificationCreateRequest,
  token: string
): Promise<QualificationResponse> {
  const res = await fetch(apiUrl('/qualification'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw await authError(res)

  return res.json() as Promise<QualificationResponse>
}

export function isChecklistComplete(checklist: ChecklistState): boolean {
  return CHECKLIST_ITEMS.every((item) => checklist[item.key])
}

export function canTransfer(snapshot: QualificationSnapshot, consent: ConsentDnc): boolean {
  if (consent.dnc_flagged) return false
  if (snapshot.disposition !== 'qualified') return false
  if (!consent.consent_given) return false
  if (isChecklistComplete(snapshot.checklist)) return true
  return snapshot.override.applied && snapshot.override.reason.trim().length > 0
}

export type Requirement = {
  key: string
  label: string
  met: boolean
  /** true once an override can satisfy this item instead of fixing it directly */
  overridable: boolean
}

export function transferRequirements(
  snapshot: QualificationSnapshot,
  consent: ConsentDnc
): Requirement[] {
  const checklistDone = isChecklistComplete(snapshot.checklist)
  const overrideActive = snapshot.override.applied && snapshot.override.reason.trim().length > 0

  return [
    {
      key: 'dnc',
      label: 'Not flagged Do Not Call',
      met: !consent.dnc_flagged,
      overridable: false,
    },
    {
      key: 'disposition',
      label: 'Disposition set to "Qualified"',
      met: snapshot.disposition === 'qualified',
      overridable: false,
    },
    {
      key: 'consent',
      label: 'Customer consent captured',
      met: consent.consent_given,
      overridable: false,
    },
    {
      key: 'checklist',
      label: 'Qualification checklist complete',
      met: checklistDone || overrideActive,
      overridable: !checklistDone,
    },
  ]
}
