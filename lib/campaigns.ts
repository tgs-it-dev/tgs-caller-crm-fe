import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type Campaign = components['schemas']['CampaignResponse']
export type CampaignList = components['schemas']['CampaignListResponse']
export type NewCampaign = components['schemas']['CampaignCreateRequest']
export type CampaignPatch = components['schemas']['CampaignUpdateRequest']

/**
 * An authenticated call that keeps its failures intact.
 *
 * Failures are thrown as AuthError so the form can put the server's `fields`
 * against the inputs they name.
 */
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

/** Campaigns the caller may see, sorted by name. */
export function listCampaigns(token: string): Promise<CampaignList> {
  return json<CampaignList>('/campaigns', token)
}

/** Teams go in the same request, so one call saves the whole campaign. */
export function createCampaign(payload: NewCampaign, token: string): Promise<Campaign> {
  return json<Campaign>('/campaigns', token, { method: 'POST', body: JSON.stringify(payload) })
}

/** Send only what changed; `team_ids`, when present, replaces the whole set. */
export function updateCampaign(id: string, patch: CampaignPatch, token: string): Promise<Campaign> {
  return json<Campaign>(`/campaigns/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}
