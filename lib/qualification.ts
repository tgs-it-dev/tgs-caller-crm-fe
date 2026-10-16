import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import type { DispositionResponse } from '@/lib/dispositions'
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

/**
 * Matched by label, unlike the other two meanings, because the flag it sets
 * lives on the qualification — there is nothing on the catalogue row to read.
 */
export const DNC_LABEL = 'Do Not Call'

export const WARRANTY_STATUS_OPTIONS = ['Active', 'Expired', 'Expiring soon', 'Unknown'] as const

/** Split a vehicle line into year / make / model for the transfer gate. */
export function parseVehicleLine(vehicle: string): {
  vehicle_year: string
  vehicle_make: string
  vehicle_model: string
} {
  const parts = vehicle.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { vehicle_year: '', vehicle_make: '', vehicle_model: '' }

  const yearIdx = parts.findIndex((part) => /^\d{4}$/.test(part))
  if (yearIdx >= 0) {
    const rest = parts.filter((_, index) => index !== yearIdx)
    return {
      vehicle_year: parts[yearIdx] ?? '',
      vehicle_make: rest[0] ?? '',
      vehicle_model: rest.slice(1).join(' '),
    }
  }

  return {
    vehicle_year: '',
    vehicle_make: parts[0] ?? '',
    vehicle_model: parts.slice(1).join(' '),
  }
}

/**
 * What to persist on the qualification. Free-text `vehicle` is the source of
 * truth for the checklist; year/make/model are only stored when the line
 * actually parsed into them — never placeholders like "not provided" or a
 * duplicated make written as model (those polluted the admin snapshot).
 */
export function snapshotJsonFromActiveCall(form: ActiveCallForm): Record<string, unknown> {
  const resolved = resolvedTransferFields(form)
  const snapshot: Record<string, unknown> = {
    vehicle: form.vehicle.trim(),
    mileage: resolved.mileage,
    state: sanitizeState(form.state).trim(),
    warranty_status: form.warranty_status,
    notes: form.notes,
  }
  for (const key of ['vehicle_year', 'vehicle_make', 'vehicle_model'] as const) {
    const value = resolved[key].trim()
    if (value) snapshot[key] = value
  }
  return snapshot
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

/** Digits only — commas and other punctuation are stripped. */
export function sanitizeMileage(value: string): string {
  return value.replace(/\D/g, '')
}

/** Letters (and spaces) only — no digits or punctuation. */
export function sanitizeState(value: string): string {
  return value.replace(/[^A-Za-z\s]/g, '')
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
    mileage: sanitizeMileage(asString(snapshot?.mileage)),
    state: sanitizeState(asString(snapshot?.state)),
    warranty_status: asString(snapshot?.warranty_status),
    notes: asString(snapshot?.notes),
    consent: consent?.consent_given ? 'yes' : consent ? 'no' : 'yes',
    dnc_flagged: consent?.dnc_flagged ?? false,
    dnc_source: consent?.dnc_source ?? null,
  }
}

/**
 * Map the Active Call form onto the BE transfer-required keys.
 *
 * Honest parse only: a free-text line that does not split into year / make /
 * model leaves those keys blank, and the transfer gate then asks for an
 * override rather than inventing values into the saved qualification.
 */
export function resolvedTransferFields(form: ActiveCallForm): {
  vehicle_year: string
  vehicle_make: string
  vehicle_model: string
  mileage: string
} {
  const vehicle = form.vehicle.trim()
  const mileage = sanitizeMileage(form.mileage)
  const parsed = parseVehicleLine(vehicle)

  return {
    vehicle_year: parsed.vehicle_year,
    vehicle_make: parsed.vehicle_make,
    vehicle_model: parsed.vehicle_model,
    mileage,
  }
}

export function missingActiveCallTransferFields(form: ActiveCallForm): RequiredTransferField[] {
  return missingRequiredFields(resolvedTransferFields(form))
}

/**
 * Complete = every starred Qualification Checklist field is filled and consent is yes.
 * That is what the fronter sees — not whether the vehicle line parsed into three tokens.
 */
export function isActiveCallChecklistComplete(form: ActiveCallForm): boolean {
  return (
    form.consent === 'yes' &&
    form.vehicle.trim().length > 0 &&
    sanitizeMileage(form.mileage).length > 0 &&
    sanitizeState(form.state).trim().length > 0 &&
    form.warranty_status.trim().length > 0
  )
}

/**
 * Whether ending a call writes a qualification at all.
 *
 * A blank form must not: `consentFromActiveCall` stamps `consent_captured_at`
 * from the form's default, so saving one on a no-answer would assert consent
 * was taken on a call nobody picked up. DNC always counts — `consent_dnc` is
 * the only place the suppression is stored.
 */
export function hasCapturedSomething(form: ActiveCallForm): boolean {
  if (form.dnc_flagged) return true
  return [form.vehicle, form.mileage, form.state, form.warranty_status, form.notes].some(
    (value) => value.trim().length > 0
  )
}

/**
 * Whether this catalogue row may be handed to a closer.
 *
 * Prefers `allows_transfer` when the API sends it. The live BE still returns
 * only id/stage/label on `DispositionResponse`, so a missing flag must not
 * lock Transfer forever — fall back to the one confirmed handoff label until
 * the catalogue columns ship.
 */
export function dispositionAllowsTransfer(
  disposition: DispositionResponse | null | undefined
): boolean {
  if (!disposition) return false
  if (typeof disposition.allows_transfer === 'boolean') {
    return disposition.allows_transfer
  }
  return disposition.label === 'Qualified - Transferred'
}

/**
 * Whether Transfer needs an override reason: incomplete checklist, or a
 * vehicle line that did not parse into the BE-required year / make / model.
 */
export function needsActiveCallOverride(form: ActiveCallForm): boolean {
  if (form.dnc_flagged) return false
  if (!isActiveCallChecklistComplete(form)) return true
  return missingActiveCallTransferFields(form).length > 0
}

/**
 * Client gate for the Transfer button. The server enforces the same rule, so
 * this only decides whether to offer the control.
 *
 * Takes the disposition, not its id — "some disposition is selected" was the
 * whole check, which let "No Answer" through. `allows_transfer`, never
 * `counts_as_qualified`: the client may yet split the two flags.
 */
export function canTransferActiveCall(
  form: ActiveCallForm,
  opts: { disposition: DispositionResponse | null; overrideReason: string }
): boolean {
  if (form.dnc_flagged) return false
  if (!dispositionAllowsTransfer(opts.disposition)) return false

  // Checklist complete and year/make/model actually present → no override.
  if (isActiveCallChecklistComplete(form) && missingActiveCallTransferFields(form).length === 0) {
    return true
  }

  // Incomplete checklist or unparsed vehicle line: override reason required.
  if (form.consent !== 'yes') return false
  return opts.overrideReason.trim().length > 0
}

/**
 * Deliberately permissive next to the transfer gate: recording what happened is
 * never the thing to block, and ending the call is how a DNC gets written down.
 */
export function canEndActiveCall(opts: { disposition: DispositionResponse | null }): boolean {
  return opts.disposition !== null
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
