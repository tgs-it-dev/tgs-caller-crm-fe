import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError, type Role } from '@/lib/auth'

export type User = components['schemas']['UserResponse']
export type UserList = components['schemas']['UserListResponse']
export type NewUser = components['schemas']['CreateUserRequest']
export type UserPatch = components['schemas']['UpdateUserRequest']

/**
 * Every role this console can name, in seniority order.
 *
 * A full Record, so a role added to the contract fails the build here instead
 * of quietly missing from the form.
 */
const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  administrator: 'Team Admin',
  qa_manager: 'QA Manager',
  qa_lead: 'QA Lead',
  qa_agent: 'QA Agent',
  closer: 'Closer',
  fronter: 'Fronter',
}

/** Full catalogue order — Super Admin may offer every entry. */
export const ASSIGNABLE_ROLES = Object.keys(ROLE_LABELS) as Role[]

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role]
}

/**
 * Roles the signed-in actor may grant. Ceilings match the API grant service:
 *
 * - Super Admin — any role, including `qa_manager` (only SA may grant that).
 * - QA Manager: `qa_lead` and `qa_agent`, on any team (never `qa_manager` or dialer/admin roles).
 * - Team Admin — `fronter` / `closer` only (cannot grant any QA role).
 */
export function grantableRoles(actorRoles: readonly Role[]): Role[] {
  if (actorRoles.includes('super_admin')) return [...ASSIGNABLE_ROLES]
  // Team Admin checked before QA Manager so a dual-role account cannot escalate
  // into granting qa_manager — only Super Admin may create QA Managers.
  if (actorRoles.includes('administrator')) return ['closer', 'fronter']
  if (actorRoles.includes('qa_manager')) return ['qa_lead', 'qa_agent']
  return []
}

/** What someone holds, as one line — a user may hold more than one role. */
export function rolesLabel(roles: Role[]): string {
  return ASSIGNABLE_ROLES.filter((role) => roles.includes(role))
    .map(roleLabel)
    .join(' · ')
}

// The API's ceiling, and far more than the beta's roster: the list is read
// whole and paged in the browser.
const PAGE_LIMIT = 200

/**
 * An authenticated call that keeps its failures intact.
 *
 * Failures are thrown as AuthError, not as a bare Error, because the form
 * behind these calls puts the server's `fields` against the inputs they name.
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

export type ListUsersQuery = {
  /** Super Admin only — members of this team; omit for the full roster. */
  teamId?: string | null
}

export function listUsers(token: string, query: ListUsersQuery = {}): Promise<UserList> {
  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
  if (query.teamId) params.set('team_id', query.teamId)
  return json<UserList>(`/auth/users?${params}`, token)
}

export function createUser(payload: NewUser, token: string): Promise<User> {
  return json<User>('/auth/users', token, { method: 'POST', body: JSON.stringify(payload) })
}

/** Send only what changed: every field of the patch is optional to the API. */
export function updateUser(id: string, patch: UserPatch, token: string): Promise<User> {
  return json<User>(`/auth/users/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** Super Admin sets someone else's password. A 204: there is nothing to read back. */
export async function setUserPassword(id: string, password: string, token: string): Promise<void> {
  const res = await fetch(apiUrl(`/auth/users/${id}/password`), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) throw await authError(res)
}
