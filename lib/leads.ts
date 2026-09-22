import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { AuthError, authError } from '@/lib/auth'

export type LeadResponse = components['schemas']['LeadResponse']
export type LeadSource = LeadResponse['source']

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
