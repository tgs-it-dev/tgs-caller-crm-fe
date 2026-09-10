/**
 * PROVISIONAL CONTRACT — not part of the backend's frozen API.
 *
 * The fronter Queue screen needs a lead display name, campaign, and a
 * ringing/waiting state, none of which exist in `lib/interactions.ts` (itself
 * provisional) or in the backend today. This is modelled as its own list
 * projection because that's what a queue endpoint returns in practice — a
 * summary row, not a full interaction. Field names are taken from the Figma
 * table columns, so treat them as a design-driven guess and reconcile with
 * `src/schemas/` once a real queue endpoint exists.
 */
export type QueueStatus = 'ringing' | 'waiting'

export type QueueEntry = {
  /** Interaction id — the row's link target once a call is picked up. */
  id: string
  lead_name: string
  lead_phone: string
  campaign_name: string
  /** Wait time is derived from this client-side rather than sent pre-rendered. */
  queued_at: string
  status: QueueStatus
}

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  return `${base}${path}`
}

export async function listQueue(token: string): Promise<QueueEntry[]> {
  const res = await fetch(apiUrl('/queue'), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error('Unable to load the queue right now.')

  return res.json()
}
