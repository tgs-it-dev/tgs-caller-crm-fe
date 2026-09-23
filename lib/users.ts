import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError, type Role } from '@/lib/auth'

export type User = components['schemas']['UserResponse']
export type UserList = components['schemas']['UserListResponse']
export type NewUser = components['schemas']['CreateUserRequest']
export type UserPatch = components['schemas']['UpdateUserRequest']

/**
 * Every role this console assigns, in the order the form lists them.
 *
 * A full Record, so a role added to the contract fails the build here instead
 * of quietly missing from the form.
 */
const ROLE_LABELS: Record<Role, string> = {
  fronter: 'Fronter',
  closer: 'Closer',
  administrator: 'Administrator',
}

export const ASSIGNABLE_ROLES = Object.keys(ROLE_LABELS) as Role[]

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role]
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

export function listUsers(token: string): Promise<UserList> {
  return json<UserList>(`/auth/users?limit=${PAGE_LIMIT}`, token)
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
