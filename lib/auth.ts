import type { components } from '@/lib/generated/schema'

/** Role literals from the frozen OpenAPI `UserResponse.roles` enum. */
export type Role = components['schemas']['UserResponse']['roles'][number]

export type LoginRequest = components['schemas']['LoginRequest']
export type TokenResponse = components['schemas']['TokenResponse']
/** `/auth/me` payload — same shape as OpenAPI `UserResponse`. */
export type CurrentUser = components['schemas']['UserResponse']

export class AuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const ROLE_LANDING: Record<Role, string> = {
  fronter: '/fronter',
  closer: '/closer',
  administrator: '/admin',
}

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  return `${base}${path}`
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string') return body.detail
  } catch {
    // response had no JSON body
  }
  if (res.status === 401) return 'Incorrect email or password.'
  return 'Something went wrong. Please try again.'
}

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new AuthError(await parseErrorMessage(res), res.status)
  }

  return res.json() as Promise<TokenResponse>
}

export async function getCurrentUser(token: string): Promise<CurrentUser> {
  const res = await fetch(apiUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new AuthError(await parseErrorMessage(res), res.status)
  }

  return res.json() as Promise<CurrentUser>
}

// The backend may grant more than one role; the primary role decides
// where the user lands, in order of seniority.
const ROLE_PRIORITY: Role[] = ['administrator', 'closer', 'fronter']

export function landingRouteForRoles(roles: Role[]): string {
  const primary = ROLE_PRIORITY.find((role) => roles.includes(role))
  return primary ? ROLE_LANDING[primary] : '/login'
}

const TOKEN_KEY = 'tgs_crm_access_token'

export function storeToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function readToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}
