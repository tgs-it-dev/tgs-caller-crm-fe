import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type CallLeg = components['schemas']['CallLegItem']
export type InteractionTransfer = components['schemas']['InteractionTransferItem']
export type InteractionEvent = components['schemas']['InteractionEventItem']
export type InteractionEventList = components['schemas']['InteractionEventListResponse']
export type QualificationRecord = components['schemas']['QualificationResponse']

/**
 * The four panels an administrator reviews an interaction through.
 *
 * The interaction itself is read with `getInteractionDetailResponse` from
 * `lib/interactions.ts` — one caller of `GET /interactions/{id}`, not two. This
 * file holds only what that file has no reason to know about.
 */
async function json<T>(path: string, token: string): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
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
 * `snapshot_json` as the fields an active call writes. It is free-form JSONB,
 * and this panel shows whatever is in it — including keys the workspace never
 * writes — so it reads the contract's own open shape.
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
