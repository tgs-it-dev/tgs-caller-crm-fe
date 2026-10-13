import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type Team = components['schemas']['TeamResponse']
export type TeamList = components['schemas']['TeamListResponse']

async function json<T>(path: string, token: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

/** Company team catalogue — Super Admin uses this to label user groups. */
export function listTeams(token: string): Promise<TeamList> {
  return json<TeamList>('/teams', token)
}
