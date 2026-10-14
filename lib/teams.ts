import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type Team = components['schemas']['TeamResponse']
export type TeamList = components['schemas']['TeamListResponse']
export type NewTeam = components['schemas']['TeamCreateRequest']
export type TeamPatch = components['schemas']['TeamUpdateRequest']

/**
 * Seeded fallback workspace — the API refuses rename / deactivate
 * (`team.default_locked`). Mirror that in the form so the refusal is never a surprise.
 */
export const DEFAULT_TEAM_NAME = 'Default Team'

export function isDefaultTeam(team: Pick<Team, 'name'>): boolean {
  return team.name === DEFAULT_TEAM_NAME
}

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

/** Company team catalogue — Super Admin only. */
export function listTeams(token: string): Promise<TeamList> {
  return json<TeamList>('/teams', token)
}

export function createTeam(payload: NewTeam, token: string): Promise<Team> {
  return json<Team>('/teams', token, { method: 'POST', body: JSON.stringify(payload) })
}

/** Send only what changed: every field of the patch is optional to the API. */
export function updateTeam(id: string, patch: TeamPatch, token: string): Promise<Team> {
  return json<Team>(`/teams/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}
