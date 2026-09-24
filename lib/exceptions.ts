import type { components, operations } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type ReconciliationException = components['schemas']['ReconciliationExceptionItem']
export type ExceptionList = components['schemas']['ReconciliationExceptionListResponse']
export type ExceptionReason = ReconciliationException['reason']
export type ResolveRequest = components['schemas']['ResolveExceptionRequest']

type ExceptionQuery = NonNullable<
  operations['list_exceptions_reconciliation_exceptions_get']['parameters']['query']
>

/**
 * Which slice of the queue to read.
 *
 * Three named values, not an optional boolean: the API takes `open`,
 * `resolved` or `any`, because a tri-state boolean can't say "either" in a
 * query string.
 */
export type ResolutionFilter = NonNullable<ExceptionQuery['resolution']>

/**
 * The API's own ceiling on a resolution note.
 *
 * Mirrored rather than generated: `maxLength` is in the OpenAPI document but
 * `openapi-typescript` has nowhere to put it in a TypeScript type. Stopping the
 * field here turns a 422 into a key that does nothing.
 */
export const NOTE_LIMIT = 2000

/**
 * What each flag means, in the words of somebody reviewing it.
 *
 * `label` is the Issue column; `meaning` sits above the evidence and says what
 * the detector actually observed. A full Record, so a reason added to the
 * contract fails the build here instead of reaching the screen as its enum.
 */
const REASON_COPY: Record<ExceptionReason, { label: string; meaning: string }> = {
  multi_leg_without_transfer: {
    label: 'Multiple legs, no transfer link',
    meaning:
      'The phone system recorded more than one leg on this call, and no transfer of any status was ever recorded against it.',
  },
  late_event_after_finalization: {
    label: 'Late event after finalization window',
    meaning:
      'Somebody dispositioned this interaction, and the phone system reported more activity well after they did.',
  },
}

export function reasonLabel(reason: ExceptionReason): string {
  return REASON_COPY[reason].label
}

export function reasonMeaning(reason: ExceptionReason): string {
  return REASON_COPY[reason].meaning
}

async function json<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

/**
 * One page of the queue.
 *
 * Paged against the server rather than read whole: a staff roster is bounded
 * and an exception queue is not — it only grows while nothing is resolved.
 */
export function listExceptions(
  query: { limit: number; offset: number; resolution: ResolutionFilter },
  token: string
): Promise<ExceptionList> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
    resolution: query.resolution,
  })
  return json<ExceptionList>(`/reconciliation/exceptions?${params}`, token)
}

/** Record that a mismatch was dealt with, or put it back on the queue. */
export function resolveException(
  id: string,
  body: ResolveRequest,
  token: string
): Promise<ReconciliationException> {
  return json<ReconciliationException>(`/reconciliation/exceptions/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
