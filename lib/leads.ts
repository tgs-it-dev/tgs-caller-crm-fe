import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { AuthError, authError } from '@/lib/auth'

export type LeadResponse = components['schemas']['LeadResponse']
export type LeadSource = LeadResponse['source']
export type LeadList = components['schemas']['LeadListResponse']
export type NewLead = components['schemas']['LeadCreateRequest']
export type LeadUpdate = components['schemas']['LeadUpdateRequest']
export type LeadBulkUpload = components['schemas']['LeadBulkUploadResponse']
export type LeadBulkRow = components['schemas']['LeadBulkRowResult']
export type LeadHistory = components['schemas']['LeadHistoryResponse']
export type LeadHistoryEvent = components['schemas']['LeadHistoryEvent']
export type LeadSearch = components['schemas']['LeadSearchResponse']
export type LeadSearchItem = components['schemas']['LeadSearchItem']

/** A fronter disposition id, `none` for leads nobody has given one, or null for all. */
export type DispositionFilter = string | null

/** Matches BE LeadFormFields / LeadCreateRequest hard caps. */
export const LEAD_NAME_MAX = 255
export const LEAD_FIELD_MAX = 255
export const LEAD_PHONE_MIN = 7
export const LEAD_PHONE_MAX = 32
export const VEHICLE_YEAR_MIN = 1900
export const VEHICLE_YEAR_MAX = 2100

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

/** A lead's details and everything that happened to it, oldest first. Super Admin only. */
export function fetchLeadHistory(leadId: string, token: string): Promise<LeadHistory> {
  return json<LeadHistory>(`/leads/${encodeURIComponent(leadId)}/history`, token)
}

/** What History lists. Form saves and offers nobody took stay on record, unlisted. */
export function shownInHistory(event: LeadHistoryEvent): boolean {
  if (event.kind === 'qualification') return false
  return !(event.kind === 'transfer_offered' && event.transfer_status === 'timeout')
}

/**
 * One page of the team's leads not yet with a closer, longest waiting first.
 * `q` is part of a name, or of a phone when it is a number; sent from one character.
 */
export function searchLeads(
  {
    q,
    disposition,
    limit,
    offset,
  }: { q: string; disposition: DispositionFilter; limit: number; offset: number },
  token: string
): Promise<LeadSearch> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (q.trim()) params.set('q', q.trim())
  if (disposition) params.set('disposition', disposition)
  return json<LeadSearch>(`/leads/search?${params}`, token)
}

/**
 * The call to record this lead's disposition or transfer on: its latest call
 * while nothing is recorded on it or it waits on a callback, otherwise a new
 * one. Ask only when saving one, never on opening the lead.
 */
export async function openLeadCall(leadId: string, token: string): Promise<string> {
  const call = await json<{ interaction_id: string }>(
    `/leads/${encodeURIComponent(leadId)}/calls`,
    token,
    { method: 'POST' }
  )
  return call.interaction_id
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
  const params = new URLSearchParams({ phone_no: phone, limit: '1' })
  const list = await json<LeadList>(`/leads?${params}`, token)
  return list.items[0] ?? null
}

/**
 * Create or fill a lead from the fronter form.
 *
 * 201 for both a new insert and a phone re-match — compare `created_at` (or
 * the presence of prior form fields) to tell them apart. `interaction_id` is
 * set so the caller can open Active Call.
 */
export function createLead(payload: NewLead, token: string): Promise<LeadResponse> {
  return json<LeadResponse>('/leads', token, { method: 'POST', body: JSON.stringify(payload) })
}

/** Overwrite personal / vehicle / VIN / plate — phone cannot change. */
export function updateLead(
  leadId: string,
  payload: LeadUpdate,
  token: string
): Promise<LeadResponse> {
  return json<LeadResponse>(`/leads/${leadId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
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

/** Display name for queue / caller chrome: first + last, else the phone. */
export function leadDisplayName(lead: Pick<LeadResponse, 'first_name' | 'last_name' | 'phone_no'>): string {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim()
  return name || lead.phone_no
}

/** Vehicle line for Active Call prefill: "2018 Toyota Camry". */
export function leadVehicleLine(
  lead: Pick<LeadResponse, 'vehicle_year' | 'vehicle_make' | 'vehicle_model'>
): string {
  return [lead.vehicle_year, lead.vehicle_make, lead.vehicle_model]
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' ')
}
