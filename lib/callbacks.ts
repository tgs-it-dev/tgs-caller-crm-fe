import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import type { QualificationResponse } from '@/lib/qualification'

export type CardEditStatus = components['schemas']['CardEditRequestItem']['status']
export type CardEditRequestItem = components['schemas']['CardEditRequestItem']
export type CardEditRequestList = components['schemas']['CardEditRequestListResponse']
export type FronterDetails = components['schemas']['LeadUpdateRequest']

export const CARD_EDIT_STATUS_LABEL: Record<CardEditStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  used: 'Used',
}

export const CARD_EDIT_STATUS_TONE: Record<CardEditStatus, 'amber' | 'done' | 'red' | 'neutral'> = {
  pending: 'amber',
  approved: 'done',
  rejected: 'red',
  used: 'neutral',
}

async function json<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

/** One page of the card edit requests this user may see; no status means all. */
export function listCardEditRequests(
  { status, limit, offset }: { status: CardEditStatus | null; limit: number; offset: number },
  token: string
): Promise<CardEditRequestList> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status) params.set('status', status)
  return json<CardEditRequestList>(`/card-edit-requests?${params}`, token)
}

/** A Super Admin's answer. */
export function decideCardEditRequest(
  requestId: string,
  status: 'approved' | 'rejected',
  token: string
): Promise<CardEditRequestItem> {
  return json<CardEditRequestItem>(
    `/card-edit-requests/${encodeURIComponent(requestId)}/decision`,
    token,
    { method: 'POST', body: JSON.stringify({ status }) }
  )
}

/** The closer asking to change the saved card on a callback. One already waiting comes back as it is. */
export function requestCardEdit(
  interactionId: string,
  reason: string | null,
  token: string
): Promise<CardEditRequestItem> {
  return json<CardEditRequestItem>(
    `/interactions/${encodeURIComponent(interactionId)}/card-edit-requests`,
    token,
    { method: 'POST', body: JSON.stringify({ reason }) }
  )
}

/** The closer's correction of the fronter's details: the lead and a new version. */
export function saveFronterDetails(
  interactionId: string,
  details: FronterDetails,
  token: string
): Promise<QualificationResponse> {
  return json<QualificationResponse>(`/interactions/${encodeURIComponent(interactionId)}/details`, token, {
    method: 'PUT',
    body: JSON.stringify(details),
  })
}
