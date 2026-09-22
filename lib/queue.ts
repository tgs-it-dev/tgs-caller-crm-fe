import { apiUrl } from '@/lib/apiUrl'

/** Desk roles that have a queue projection on `GET /queue?role=`. */
export type QueueRole = 'fronter' | 'closer'

export type FronterQueueStatus = 'ringing' | 'waiting'
export type CloserQueueStatus = 'initiated' | 'offered'

/** @deprecated Prefer `FronterQueueStatus` — kept for existing fronter imports. */
export type QueueStatus = FronterQueueStatus

export type FronterQueueEntry = {
  /** Interaction id — the row's link target once a call is picked up. */
  id: string
  lead_name: string
  lead_phone: string
  campaign_name: string
  /** Wait time is derived from this client-side rather than sent pre-rendered. */
  queued_at: string
  status: FronterQueueStatus
}

/** @deprecated Prefer `FronterQueueEntry`. */
export type QueueEntry = FronterQueueEntry

export type CloserQueueEntry = {
  /** Transfer id. */
  id: string
  /** Interaction id — workspace link target. */
  interaction_id: string
  lead_phone: string
  fronter_user_id: string | null
  queued_at: string
  status: CloserQueueStatus
}

/**
 * Coalesces concurrent `/queue?role=` calls (e.g. React Strict Mode remounts)
 * while the request is still in flight. Cleared on settle so a later remount
 * (navigate away and back) always fetches fresh data. Pass `bust: true` for
 * the 15s poll so it never joins a still-in-flight call.
 */
const inflightByRole = new Map<QueueRole, Promise<FronterQueueEntry[] | CloserQueueEntry[]>>()

export function listQueue(
  token: string,
  role: 'fronter',
  opts?: { bust?: boolean }
): Promise<FronterQueueEntry[]>
export function listQueue(
  token: string,
  role: 'closer',
  opts?: { bust?: boolean }
): Promise<CloserQueueEntry[]>
export function listQueue(
  token: string,
  role: QueueRole,
  { bust = false }: { bust?: boolean } = {}
): Promise<FronterQueueEntry[] | CloserQueueEntry[]> {
  if (bust) inflightByRole.delete(role)

  let inflight = inflightByRole.get(role)
  if (!inflight) {
    inflight = fetch(apiUrl(`/queue?role=${role}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load the queue right now.')
        return res.json() as Promise<FronterQueueEntry[] | CloserQueueEntry[]>
      })
      .finally(() => {
        if (inflightByRole.get(role) === inflight) inflightByRole.delete(role)
      })
    inflightByRole.set(role, inflight)
  }
  return inflight
}
