import type { components } from '@/lib/generated/schema'
import { readApiError, type FieldError } from '@/lib/apiError'
import { apiUrl } from '@/lib/apiUrl'
import type { TimeZoneName } from '@/lib/format'
import { deleteSession, saveSession, type SavedSession } from '@/lib/sessionStore'

/** Role literals from the frozen OpenAPI `UserResponse.roles` enum. */
export type Role = components['schemas']['UserResponse']['roles'][number]

export type LoginRequest = components['schemas']['LoginRequest']
export type TokenResponse = components['schemas']['TokenResponse']
/** `/auth/me` payload — same shape as OpenAPI `UserResponse`. */
export type CurrentUser = components['schemas']['UserResponse']

export class AuthError extends Error {
  status: number
  code: string
  fields: FieldError[]

  constructor(message: string, status: number, code: string, fields: FieldError[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

const ROLE_LANDING: Record<Role, string> = {
  fronter: '/fronter',
  // Closer desk opens on Queue (pick/accept a transfer); Active Call is `/closer`.
  closer: '/closer/queue',
  administrator: '/admin',
  // QA Manager modules are Users only — not the Team Admin dashboard or SA chrome.
  qa_manager: '/admin/users',
  // QA Agent desk is a later ticket; land somewhere gated until it ships.
  qa_agent: '/qa',
  // Super Admin modules are Users / Teams / Campaigns — not the Team Admin dashboard.
  super_admin: '/admin/users',
}

export async function authError(res: Response): Promise<AuthError> {
  const { status, code, message, fields } = await readApiError(res)
  return new AuthError(message, status, code, fields)
}

function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  const res = await postJson('/auth/login', payload)
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<TokenResponse>
}

/** Trade a refresh token for a new pair. The old refresh token stops working. */
export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const res = await postJson('/auth/refresh', { refresh_token: refreshToken })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<TokenResponse>
}

/** End the session on the server. Always 204, whether the token was live or not. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await postJson('/auth/logout', { refresh_token: refreshToken })
}

export async function getCurrentUser(token: string): Promise<CurrentUser> {
  const res = await fetch(apiUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<CurrentUser>
}

/** Save the signed-in user's own time zone; the updated profile comes back. */
export async function updateMyTimezone(timezone: TimeZoneName, token: string): Promise<CurrentUser> {
  const res = await fetch(apiUrl('/auth/me'), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timezone }),
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<CurrentUser>
}

/**
 * Change your own password. The API ends every session, this one's included, and
 * hands back a fresh pair; call it through `changePassword` in `lib/session.ts`,
 * which stores that pair before any renewal can run.
 */
export async function requestPasswordChange(
  currentPassword: string,
  newPassword: string,
  token: string
): Promise<TokenResponse> {
  const res = await fetch(apiUrl('/auth/password/change'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<TokenResponse>
}

// The backend may grant more than one role; the primary role decides
// where the user lands, in order of seniority.
const ROLE_PRIORITY: Role[] = [
  'super_admin',
  'administrator',
  'qa_manager',
  'closer',
  'fronter',
  'qa_agent',
]

/**
 * Whether any held role meets a gate. Super Admin inherits every Team Admin
 * surface; QA Manager is never treated as Team Admin; every other requirement
 * is an exact match.
 */
export function roleSatisfies(held: readonly Role[], required: Role): boolean {
  if (required === 'administrator' && held.includes('super_admin')) return true
  return held.includes(required)
}

/**
 * Which admin desk identity to show for `/admin`. Super Admin, Team Admin and
 * QA Manager share that segment; prefer the most senior when several are held.
 * Never map qa_manager onto administrator.
 */
export function adminDeskRole(
  roles: readonly Role[],
): 'super_admin' | 'administrator' | 'qa_manager' | null {
  if (roles.includes('super_admin')) return 'super_admin'
  if (roles.includes('administrator')) return 'administrator'
  if (roles.includes('qa_manager')) return 'qa_manager'
  return null
}

/** Super Admin has no team pin — never invent a fake membership in the UI. */
export function isSuperAdmin(roles: readonly Role[]): boolean {
  return roles.includes('super_admin')
}

/** Team Admin role held as such — Super Admin and QA Manager are not this. */
export function isTeamAdmin(roles: readonly Role[]): boolean {
  return roles.includes('administrator')
}

/** QA Manager role held as such — not administrator, not Super Admin. */
export function isQaManager(roles: readonly Role[]): boolean {
  return roles.includes('qa_manager')
}

/** True when `/auth/me` (or a user row) carries a real team pin. */
export function hasTeamPin(user: { team_id?: string | null }): boolean {
  return user.team_id != null && user.team_id !== ''
}

const DESK_LABEL: Record<Role, string> = {
  fronter: 'CRM — Fronter',
  closer: 'CRM — Closer',
  administrator: 'CRM — Team Admin',
  qa_manager: 'CRM — QA Manager',
  qa_agent: 'CRM — QA Agent',
  super_admin: 'CRM — Super Admin',
}

const ROLE_NAME: Record<Role, string> = {
  fronter: 'Fronter',
  closer: 'Closer',
  administrator: 'Team Admin',
  qa_manager: 'QA Manager',
  qa_agent: 'QA Agent',
  super_admin: 'Super Admin',
}

export function primaryRole(roles: Role[]): Role | null {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null
}

/**
 * Every desk this user holds, most senior first.
 *
 * Super Admin and Team Admin share `/admin`, so only one admin desk entry is
 * emitted — two switcher rows that both land on `/admin` would be wrong.
 * `primaryRole` answers where they land; this answers where else they may go.
 */
export function heldDesks(roles: Role[]): Role[] {
  const desks: Role[] = []
  const admin = adminDeskRole(roles)
  if (admin) desks.push(admin)
  if (roles.includes('closer')) desks.push('closer')
  if (roles.includes('fronter')) desks.push('fronter')
  // QA Agent is its own desk once the workspace ships; until then it still
  // needs a switcher entry when held alongside another role.
  if (roles.includes('qa_agent') && !admin) desks.push('qa_agent')
  return desks
}

export function landingRouteForRoles(roles: Role[]): string {
  const primary = primaryRole(roles)
  return primary ? ROLE_LANDING[primary] : '/login'
}

/**
 * Which desk the current URL belongs to — drives sidebar nav without a
 * hardcoded prop. Pass `roles` on `/admin/*` so Super Admin vs Team Admin
 * matches `heldDesks` (path alone cannot tell them apart).
 */
export function deskRoleFromPath(pathname: string, roles?: readonly Role[]): Role | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (roles) return adminDeskRole(roles) ?? 'administrator'
    return 'administrator'
  }
  if (pathname === '/qa' || pathname.startsWith('/qa/')) return 'qa_agent'
  if (pathname === '/closer' || pathname.startsWith('/closer/')) return 'closer'
  if (pathname === '/fronter' || pathname.startsWith('/fronter/')) return 'fronter'
  return null
}

/** Desk header label for a layout segment (or the user's primary role). */
export function deskLabelForRole(role: Role): string {
  return DESK_LABEL[role]
}

/** Human-readable roles from `/auth/me` (e.g. "Team Admin", "Fronter · Closer"). */
export function formatRolesLabel(roles: Role[]): string {
  const ordered = ROLE_PRIORITY.filter((role) => roles.includes(role))
  return ordered.map((role) => ROLE_NAME[role]).join(' · ')
}

/** Two-letter avatar initials from a display name. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export const ACCESS_TOKEN_KEY = 'tgs_crm_access_token'
const REFRESH_TOKEN_KEY = 'tgs_crm_refresh_token'
export const EXPIRES_AT_KEY = 'tgs_crm_access_expires_at'

/** This tab's copy, for everything that reads synchronously. */
export function copySession(session: SavedSession) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token)
  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token)
  window.localStorage.setItem(EXPIRES_AT_KEY, String(session.expires_at))
}

/**
 * Keep a new session in both places. Resolves once the stored copy — the one
 * renewals trust, see lib/sessionStore.ts — is written.
 */
export function storeSession(tokens: TokenResponse): Promise<void> {
  const session = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    // From the stated lifetime rather than the token itself: mock tokens aren't JWTs.
    expires_at: Date.now() + tokens.expires_in_min * 60_000,
  }
  copySession(session)
  return saveSession(session)
}

export function readToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function readRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(REFRESH_TOKEN_KEY)
}

/** When the access token expires, in epoch milliseconds, or null without a session. */
export function readExpiresAt(): number | null {
  if (typeof window === 'undefined') return null
  const expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY))
  return expiresAt > 0 ? expiresAt : null
}

/** This tab's copy only: the page reads as signed out the moment this returns. */
export function clearLocalSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
  window.localStorage.removeItem(EXPIRES_AT_KEY)
}

export function clearSession(): Promise<void> {
  clearLocalSession()
  return deleteSession()
}
