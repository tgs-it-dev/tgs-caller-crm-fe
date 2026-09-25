import type { components } from '@/lib/generated/schema'
import { readApiError, type FieldError } from '@/lib/apiError'
import { apiUrl } from '@/lib/apiUrl'
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
  closer: '/closer',
  administrator: '/admin',
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

// The backend may grant more than one role; the primary role decides
// where the user lands, in order of seniority.
const ROLE_PRIORITY: Role[] = ['administrator', 'closer', 'fronter']

const DESK_LABEL: Record<Role, string> = {
  fronter: 'CRM — Fronter',
  closer: 'CRM — Closer',
  administrator: 'CRM — Admin',
}

const ROLE_NAME: Record<Role, string> = {
  fronter: 'Fronter',
  closer: 'Closer',
  administrator: 'Administrator',
}

export function primaryRole(roles: Role[]): Role | null {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null
}

/**
 * Every desk this user holds, most senior first.
 *
 * `primaryRole` answers where they land; this answers where else they may go.
 * Both read the same order, so the desk they start on is always the first one
 * the switcher would have offered.
 */
export function heldDesks(roles: Role[]): Role[] {
  return ROLE_PRIORITY.filter((role) => roles.includes(role))
}

export function landingRouteForRoles(roles: Role[]): string {
  const primary = primaryRole(roles)
  return primary ? ROLE_LANDING[primary] : '/login'
}

/** Which desk the current URL belongs to — drives sidebar nav without a hardcoded prop. */
export function deskRoleFromPath(pathname: string): Role | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'administrator'
  if (pathname === '/closer' || pathname.startsWith('/closer/')) return 'closer'
  if (pathname === '/fronter' || pathname.startsWith('/fronter/')) return 'fronter'
  return null
}

/** Desk header label for a layout segment (or the user's primary role). */
export function deskLabelForRole(role: Role): string {
  return DESK_LABEL[role]
}

/** Human-readable roles from `/auth/me` (e.g. "Administrator", "Fronter · Closer"). */
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
