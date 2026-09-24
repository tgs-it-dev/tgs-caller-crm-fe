import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type InteractionDetailResponse = components['schemas']['InteractionDetailResponse']
export type CallLeg = components['schemas']['CallLegItem']
export type InteractionTransfer = components['schemas']['InteractionTransferItem']
export type InteractionEvent = components['schemas']['InteractionEventItem']
export type InteractionEventList = components['schemas']['InteractionEventListResponse']
export type QualificationRecord = components['schemas']['QualificationResponse']

/**
 * The administrator's read of one interaction — the four review panels.
 *
 * Deliberately separate from `lib/interactions.ts`, which still carries the
 * provisional shape the fronter and closer workspaces were built against.
 * Everything here is typed from the generated contract.
 */
async function json<T>(path: string, token: string): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

/** A missing interaction throws an `AuthError` with code `interaction.not_found`. */
export function getInteractionDetail(
  interactionId: string,
  token: string
): Promise<InteractionDetailResponse> {
  return json<InteractionDetailResponse>(`/interactions/${interactionId}`, token)
}

export async function listCallLegs(interactionId: string, token: string): Promise<CallLeg[]> {
  const body = await json<components['schemas']['CallLegListResponse']>(
    `/interactions/${interactionId}/call-legs`,
    token
  )
  return body.items
}

export async function listInteractionTransfers(
  interactionId: string,
  token: string
): Promise<InteractionTransfer[]> {
  const body = await json<components['schemas']['InteractionTransferListResponse']>(
    `/interactions/${interactionId}/transfers`,
    token
  )
  return body.items
}

export function listInteractionEvents(
  interactionId: string,
  page: { limit: number; offset: number },
  token: string
): Promise<InteractionEventList> {
  const params = new URLSearchParams({
    limit: String(page.limit),
    offset: String(page.offset),
  })
  return json<InteractionEventList>(`/interactions/${interactionId}/events?${params}`, token)
}

/**
 * The full qualification, or null where none was ever saved.
 *
 * `lib/qualification.ts` reads the same route for the workspaces, but declares
 * `snapshot_json` as the fronter checklist. It is free-form JSONB, and this
 * panel shows whatever is in it, so it reads the contract's own open shape.
 */
export async function getQualificationRecord(
  interactionId: string,
  token: string
): Promise<QualificationRecord | null> {
  const res = await fetch(apiUrl(`/qualification/${interactionId}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<QualificationRecord>
}
