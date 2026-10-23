import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

/** Desk roles that have a queue projection on `GET /queue?role=`. */
export type QueueRole = 'fronter' | 'closer'

/**
 * Fronter worklist is callbacks only (disposition Callback).
 * Dialer accept / leave endpoints are gone.
 */
export type FronterQueueEntry = components['schemas']['FronterCallbackItem']

/** @deprecated Prefer `FronterQueueEntry`. */
export type QueueEntry = FronterQueueEntry

/** Pending offers, plus this closer's open accepted call (not yet dispositioned). */
export type CloserQueueStatus = 'initiated' | 'offered' | 'accepted'

export type CloserQueueEntry = {
  /** Transfer id. */
  id: string
  /** Interaction id — workspace link target. */
  interaction_id: string
  lead_name: string
  lead_phone: string
  fronter_user_id: string | null
  queued_at: string
  status: CloserQueueStatus
}

/** Active Call URL — query param so static export / S3 can serve the shell. */
export function fronterWorkspaceHref(interactionId: string): string {
  return `/fronter/workspace/?id=${encodeURIComponent(interactionId)}`
}

/**
 * Coalesces concurrent `/queue?role=` calls (e.g. React Strict Mode remounts)
 * while the request is still in flight. Cleared on settle so a later remount
 * (navigate away and back) always fetches fresh data. Pass `bust: true` for
 * the poll so it never joins a still-in-flight call.
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
        if (!res.ok) throw await authError(res)
        return res.json() as Promise<FronterQueueEntry[] | CloserQueueEntry[]>
      })
      .finally(() => {
        if (inflightByRole.get(role) === inflight) inflightByRole.delete(role)
      })
    inflightByRole.set(role, inflight)
  }
  return inflight
}
