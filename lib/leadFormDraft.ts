/**
 * Optional fields from the fronter lead form that Active Call should preselect
 * (disposition) without capturing yet. Stashed under the minted interaction id,
 * read once, then discarded.
 */
export type LeadFormDraft = {
  disposition_id?: string
}

const KEY_PREFIX = 'tgs_crm_lead_form_draft_'

export function stashLeadFormDraft(interactionId: string, draft: LeadFormDraft): void {
  if (typeof window === 'undefined') return
  const dispositionId = draft.disposition_id?.trim()
  if (!dispositionId) return
  try {
    sessionStorage.setItem(
      KEY_PREFIX + interactionId,
      JSON.stringify({ disposition_id: dispositionId })
    )
  } catch {
    // Private mode / quota — Active Call simply starts without the seed.
  }
}

/** Read-once: clears so a later remount does not re-apply a stale seed. */
export function takeLeadFormDraft(interactionId: string): LeadFormDraft | null {
  if (typeof window === 'undefined') return null
  const key = KEY_PREFIX + interactionId
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    sessionStorage.removeItem(key)
    const parsed = JSON.parse(raw) as LeadFormDraft
    if (typeof parsed !== 'object' || parsed === null) return null
    return typeof parsed.disposition_id === 'string'
      ? { disposition_id: parsed.disposition_id }
      : null
  } catch {
    return null
  }
}

/** Catalogue label that places an interaction on the fronter callback list. */
export const CALLBACK_DISPOSITION_LABEL = 'Callback Requested'
