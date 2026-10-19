import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

/** Desk roles that have a queue projection on `GET /queue?role=`. */
export type QueueRole = 'fronter' | 'closer'

/**
 * ringing | waiting = unclaimed (or demo status); accepted = this fronter claimed it.
 * Other fronters no longer see accepted rows on GET /queue?role=fronter.
 */
export type FronterQueueStatus = components['schemas']['FronterQueueItem']['status']
/** Pending offers, plus this closer's open accepted call (not yet dispositioned). */
export type CloserQueueStatus = 'initiated' | 'offered' | 'accepted'

/** @deprecated Prefer `FronterQueueStatus` — kept for existing fronter imports. */
export type QueueStatus = FronterQueueStatus

export type FronterQueueEntry = components['schemas']['FronterQueueItem']

/** @deprecated Prefer `FronterQueueEntry`. */
export type QueueEntry = FronterQueueEntry

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

export type AcceptFronterQueueRequest = components['schemas']['AcceptFronterQueueRequest']

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

/** Fronter claims an unclaimed dialer-queue row. Body `fronter_user_id` must match the token. */
export async function acceptFronterQueue(
  interactionId: string,
  payload: AcceptFronterQueueRequest,
  token: string
): Promise<FronterQueueEntry> {
  const res = await fetch(
    apiUrl(`/queue/fronter/${encodeURIComponent(interactionId)}/accept`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }
  )
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<FronterQueueEntry>
}

/**
 * Drop a row off the fronter queue once the call has been dealt with.
 *
 * The queue also hides interactions that carry a qualification, but a call
 * that ended without one — a no-answer, say — has nothing to hide behind, so
 * it would sit there until the dialer took it back. This is what says it left.
 *
 * Resolves rather than throws on 404: an interaction opened by direct link may
 * have no open queue row at all, and by the time this runs the outcome is
 * already recorded. Failing here would report an error for work that succeeded.
 */
export async function leaveFronterQueue(interactionId: string, token: string): Promise<void> {
  const res = await fetch(apiUrl(`/queue/fronter/${encodeURIComponent(interactionId)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ left: true }),
  })
  if (res.ok || res.status === 404) return
  throw await authError(res)
}
