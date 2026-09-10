// Mirrors the backend's frozen contract in src/schemas/qualification.py —
// keep these Literal-equivalents in sync with src/schemas/common.py.
export type LeadSource = 'vicidial' | 'ghl'

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

// `dispositions.py` on the backend is an unbuilt week-4 scaffold with no
// catalogue yet, so this outcome set is folded into the qualification
// snapshot rather than a second fabricated CRUD endpoint. Reconcile against
// the real disposition catalogue once it ships.
export const DISPOSITIONS = [
  { value: 'qualified', label: 'Qualified — ready to transfer' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'callback_requested', label: 'Callback requested' },
  { value: 'do_not_call', label: 'Do not call' },
  { value: 'invalid_number', label: 'Invalid / wrong number' },
] as const

export type Disposition = (typeof DISPOSITIONS)[number]['value']

// BE-B-06 override path (assumed; the backend ticket text wasn't available
// to consult). A fronter can bypass an incomplete checklist to force a
// transfer, but never bypasses a DNC flag — that's a compliance stop, not a
// process gate. The reason is recorded so it's auditable.
export type QualificationOverride = {
  applied: boolean
  reason: string
}

export type QualificationSnapshot = {
  checklist: ChecklistState
  disposition: Disposition | null
  notes: string
  override: QualificationOverride
}

// Matches src/schemas/qualification.py:ConsentDnc exactly.
export type ConsentDnc = {
  consent_given: boolean
  consent_captured_at: string | null
  dnc_flagged: boolean
  dnc_source: string | null
}

export type QualificationResponse = {
  id: string
  interaction_id: string
  version: number
  snapshot_json: QualificationSnapshot
  consent_dnc: ConsentDnc
  created_at: string
  updated_at: string
}

export type QualificationCreateRequest = {
  interaction_id: string
  snapshot_json: QualificationSnapshot
  consent_dnc: ConsentDnc
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
  if (!res.ok) throw new Error('Unable to load the saved qualification.')

  return res.json()
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

  if (!res.ok) throw new Error('Unable to save the qualification. Please try again.')

  return res.json()
}

export function isChecklistComplete(checklist: ChecklistState): boolean {
  return CHECKLIST_ITEMS.every((item) => checklist[item.key])
}

export function canTransfer(snapshot: QualificationSnapshot, consent: ConsentDnc): boolean {
  if (consent.dnc_flagged) return false // hard compliance stop — no override bypasses this
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

// Drives the "what's blocking transfer, and why" panel — one source of truth
// so the UI never drifts from canTransfer()'s actual gating logic.
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
