import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { AuthError, authError } from '@/lib/auth'
import { getLead, type LeadResponse } from '@/lib/leads'
import type { LeadSource } from '@/lib/qualification'

export type InteractionDetailResponse = components['schemas']['InteractionDetailResponse']
export type InteractionQualificationSummary =
  components['schemas']['InteractionQualificationSummary']

export type InteractionStatus = 'active' | 'wrap_up' | 'closed'

export type LeadSummary = {
  id: string
  phone_normalized: string
  source: LeadSource
  created_at: string
}

/**
 * Workspace view model. BE `InteractionDetailResponse` only has `lead_id` +
 * timestamps — `getInteraction` expands the lead via `GET /leads/{lead_id}`
 * and maps `created_at` → `started_at`.
 */
export type InteractionDetail = {
  id: string
  lead_id: string
  status: InteractionStatus
  started_at: string
  updated_at: string
  lead: LeadSummary
  qualification: InteractionQualificationSummary | null
}

export class InteractionNotFoundError extends Error {
  constructor(message = 'This call is no longer available.') {
    super(message)
    this.name = 'InteractionNotFoundError'
  }
}

function toLeadSummary(lead: LeadResponse): LeadSummary {
  return {
    id: lead.id,
    phone_normalized: lead.phone_normalized,
    source: lead.source,
    created_at: lead.created_at,
  }
}

function mapInteraction(
  detail: InteractionDetailResponse,
  lead: LeadResponse
): InteractionDetail {
  return {
    id: detail.id,
    lead_id: detail.lead_id,
    started_at: detail.created_at,
    updated_at: detail.updated_at,
    status: 'active',
    lead: toLeadSummary(lead),
    qualification: detail.qualification,
  }
}

async function expandInteraction(
  detail: InteractionDetailResponse,
  token: string
): Promise<InteractionDetail> {
  try {
    const lead = await getLead(detail.lead_id, token)
    return mapInteraction(detail, lead)
  } catch (err) {
    if (err instanceof AuthError && err.status === 404) {
      throw new InteractionNotFoundError('This call is no longer available.')
    }
    throw err
  }
}

export async function getInteractionDetailResponse(
  interactionId: string,
  token: string
): Promise<InteractionDetailResponse> {
  const res = await fetch(apiUrl(`/interactions/${interactionId}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) throw new InteractionNotFoundError()
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<InteractionDetailResponse>
}

/** `GET /interactions/{id}` + `GET /leads/{lead_id}`. */
export async function getInteraction(
  interactionId: string,
  token: string
): Promise<InteractionDetail> {
  const detail = await getInteractionDetailResponse(interactionId, token)
  return expandInteraction(detail, token)
}

/**
 * Provisional list helper (not in frozen OpenAPI). Mock still serves
 * `GET /interactions`; each row is expanded the same way as detail.
 */
export async function listInteractions(token: string): Promise<InteractionDetail[]> {
  const res = await fetch(apiUrl('/interactions'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  const rows = (await res.json()) as InteractionDetailResponse[]
  return Promise.all(rows.map((row) => expandInteraction(row, token)))
}
