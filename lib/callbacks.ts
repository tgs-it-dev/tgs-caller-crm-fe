import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import type { QualificationResponse } from '@/lib/qualification'

export type CallbackRequestStatus = components['schemas']['CallbackRequestItem']['status']
export type CallbackRequestItem = components['schemas']['CallbackRequestItem']
export type CallbackRequestList = components['schemas']['CallbackRequestListResponse']
export type FronterDetails = components['schemas']['LeadUpdateRequest']

export const CALLBACK_STATUS_LABEL: Record<CallbackRequestStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const CALLBACK_STATUS_TONE: Record<CallbackRequestStatus, 'amber' | 'done' | 'red'> = {
  pending: 'amber',
  approved: 'done',
  rejected: 'red',
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

/** One page of the callback requests this user may see; no status means all. */
export function listCallbackRequests(
  {
    status,
    limit,
    offset,
  }: { status: CallbackRequestStatus | null; limit: number; offset: number },
  token: string
): Promise<CallbackRequestList> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status) params.set('status', status)
  return json<CallbackRequestList>(`/callback-requests?${params}`, token)
}

/** A Super Admin's answer. */
export function decideCallbackRequest(
  requestId: string,
  status: 'approved' | 'rejected',
  token: string
): Promise<CallbackRequestItem> {
  return json<CallbackRequestItem>(
    `/callback-requests/${encodeURIComponent(requestId)}/decision`,
    token,
    { method: 'POST', body: JSON.stringify({ status }) }
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
