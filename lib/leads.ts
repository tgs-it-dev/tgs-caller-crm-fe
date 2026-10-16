import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { AuthError, authError } from '@/lib/auth'

export type LeadResponse = components['schemas']['LeadResponse']
export type LeadSource = LeadResponse['source']
export type LeadList = components['schemas']['LeadListResponse']
export type NewLead = components['schemas']['LeadCreateRequest']
export type LeadBulkUpload = components['schemas']['LeadBulkUploadResponse']
export type LeadBulkRow = components['schemas']['LeadBulkRowResult']

/**
 * An authenticated call that keeps its failures intact.
 *
 * Only a JSON body is labelled: for FormData the browser writes the
 * Content-Type itself, boundary included.
 */
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

export async function getLead(leadId: string, token: string): Promise<LeadResponse> {
  const res = await fetch(apiUrl(`/leads/${leadId}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<LeadResponse>
}

/** Narrow `AuthError` so callers can distinguish a missing lead from other failures. */
export function isLeadNotFound(err: unknown): err is AuthError {
  return err instanceof AuthError && (err.status === 404 || err.code === 'lead.not_found')
}

/** One page of the caller's team's leads, newest first. */
export function listLeads(
  page: { limit: number; offset: number },
  token: string
): Promise<LeadList> {
  const params = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) })
  return json<LeadList>(`/leads?${params}`, token)
}

/** The team's lead for this number, written any way, or null. */
export async function findLeadOnTeam(phone: string, token: string): Promise<LeadResponse | null> {
  const params = new URLSearchParams({ phone_normalized: phone, limit: '1' })
  const list = await json<LeadList>(`/leads?${params}`, token)
  return list.items[0] ?? null
}

/** A number already on the team comes back as that lead, with the same 201. */
export function createLead(payload: NewLead, token: string): Promise<LeadResponse> {
  return json<LeadResponse>('/leads', token, { method: 'POST', body: JSON.stringify(payload) })
}

export function uploadLeads(
  file: File,
  campaignId: string | null,
  token: string
): Promise<LeadBulkUpload> {
  const form = new FormData()
  form.append('file', file)
  if (campaignId) form.append('campaign_id', campaignId)
  return json<LeadBulkUpload>('/leads/bulk', token, { method: 'POST', body: form })
}
