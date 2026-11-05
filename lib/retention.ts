import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type PolicyStatus = components['schemas']['RetentionStatusRequest']['status']
export type RetentionSale = components['schemas']['RetentionSale']
export type RetentionSaleList = components['schemas']['RetentionSaleListResponse']
export type RetentionSaleDetail = components['schemas']['RetentionSaleDetail']
export type RetentionStatusEvent = components['schemas']['RetentionStatusEvent']
export type RetentionUploadCheck = components['schemas']['RetentionUploadCheck']
export type RetentionUploadRow = components['schemas']['RetentionUploadRow']
export type RetentionInvalidRow = components['schemas']['RetentionInvalidRow']

/** The API's limit on a note. */
export const RETENTION_NOTE_MAX = 2000

export const POLICY_STATUSES: PolicyStatus[] = ['pending', 'retained', 'cancelled']

export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  pending: 'Pending',
  retained: 'Retained',
  cancelled: 'Cancelled',
}

export const POLICY_STATUS_TONE: Record<PolicyStatus, 'amber' | 'done' | 'red'> = {
  pending: 'amber',
  retained: 'done',
  cancelled: 'red',
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

function withFile(file: File): RequestInit {
  const form = new FormData()
  form.append('file', file)
  // No Content-Type: the browser writes it, boundary included.
  return { method: 'POST', body: form }
}

/** One page of the sales whose policy is Pending, the longest since its last change first. */
export function listPending(
  { limit, offset }: { limit: number; offset: number },
  token: string
): Promise<RetentionSaleList> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return json<RetentionSaleList>(`/retention/pending?${params}`, token)
}

/** The sale carrying exactly this policy number, in any case: none or one. */
export async function findSales(policyNumber: string, token: string): Promise<RetentionSale[]> {
  const params = new URLSearchParams({ policy_number: policyNumber.trim() })
  return (await json<{ items: RetentionSale[] }>(`/retention/sales?${params}`, token)).items
}

/** The sale, its policy's status history and QA's review. */
export function getRetentionSale(interactionId: string, token: string): Promise<RetentionSaleDetail> {
  return json<RetentionSaleDetail>(`/retention/sales/${encodeURIComponent(interactionId)}`, token)
}

/** Sets the sale's policy status. A blank note is sent as none. */
export function setPolicyStatus(
  interactionId: string,
  status: PolicyStatus,
  note: string,
  token: string
): Promise<RetentionStatusEvent> {
  return json<RetentionStatusEvent>(
    `/retention/sales/${encodeURIComponent(interactionId)}/status`,
    token,
    { method: 'POST', body: JSON.stringify({ status, note: note.trim() || null }) }
  )
}

/** What saving the file would do, row by row. Saves nothing. */
export function checkStatusFile(file: File, token: string): Promise<RetentionUploadCheck> {
  return json<RetentionUploadCheck>('/retention/uploads/check', token, withFile(file))
}

/** Saves the file's changes, checked afresh, and says how many there were. */
export async function saveStatusFile(file: File, token: string): Promise<number> {
  return (await json<{ saved: number }>('/retention/uploads', token, withFile(file))).saved
}
