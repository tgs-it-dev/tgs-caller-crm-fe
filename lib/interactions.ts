import type { LeadSource } from '@/lib/qualification'

/**
 * PROVISIONAL CONTRACT — not part of the backend's frozen API.
 *
 * `src/routers/interactions.py` in the backend is still an unbuilt scaffold
 * (no schema, no real routes) as of this writing. This shape is a
 * frontend-side placeholder so the workspace screen has something to render
 * against today. Reconcile this file with the real interaction contract as
 * soon as `src/schemas/interactions.py` exists on the backend — the field
 * names here are a best guess, not a promise.
 */
export type InteractionStatus = 'active' | 'wrap_up' | 'closed'

export type LeadSummary = {
  id: string
  phone_normalized: string
  source: LeadSource
  created_at: string
}

export type InteractionDetail = {
  id: string
  status: InteractionStatus
  started_at: string
  lead: LeadSummary
}

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  return `${base}${path}`
}

export class InteractionNotFoundError extends Error {}

export async function listInteractions(token: string): Promise<InteractionDetail[]> {
  const res = await fetch(apiUrl('/interactions'), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error('Unable to load your queue right now.')

  return res.json()
}

export async function getInteraction(
  interactionId: string,
  token: string
): Promise<InteractionDetail> {
  const res = await fetch(apiUrl(`/interactions/${interactionId}`), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 404) {
    throw new InteractionNotFoundError('This call is no longer available.')
  }
  if (!res.ok) {
    throw new Error('Unable to load this call right now.')
  }

  return res.json()
}
