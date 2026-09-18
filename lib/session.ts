import {
  AuthError,
  clearSession,
  readRefreshToken,
  readToken,
  refreshTokens,
  revokeRefreshToken,
  storeSession,
} from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'

const REFRESH_LOCK = 'tgs-crm-refresh'

let inFlight: Promise<void> | null = null

function sessionEnded(): AuthError {
  return new AuthError(
    'Your session has ended. Please sign in again.',
    401,
    'auth.not_authenticated'
  )
}

/**
 * Renew the access token — once, however many callers ask at the same time.
 *
 * Refresh tokens rotate, and the API treats a spent one presented again as
 * theft: it ends every session the user has. So a token must never be sent
 * twice. Callers in this tab share one request, and tabs take turns through a
 * Web Lock; a tab that waited re-reads storage first, and if the token changed
 * meanwhile, another tab already renewed and there is nothing left to do.
 */
export function refreshSession(): Promise<void> {
  if (!inFlight) {
    const seen = readRefreshToken()
    inFlight = withRefreshLock(() => renew(seen)).finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

function withRefreshLock(task: () => Promise<void>): Promise<void> {
  // Absent only outside a secure context; there, tabs can still collide.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK, task)
  }
  return task()
}

async function renew(seen: string | null): Promise<void> {
  const current = readRefreshToken()
  if (!current) throw sessionEnded()
  if (current !== seen) return

  await waitForMocking()
  try {
    const tokens = await refreshTokens(current)
    if (readRefreshToken() !== current) {
      // Signed out while this was in flight. Storing the new pair would put the
      // user back in a session they ended, and the logout revoked the token we
      // traded in, not this one — left alive it still reads as signed in.
      revokeRefreshToken(tokens.refresh_token).catch(() => {})
      return
    }
    storeSession(tokens)
  } catch (err) {
    // A 401 means the token is spent or revoked, and nothing will renew it. Any
    // other failure — a crash, no connection — may pass, so the session stays.
    if (err instanceof AuthError && err.status === 401) clearSession()
    throw err
  }
}

/**
 * Call the API with the current access token, renewing it once if the server
 * says it is no longer valid.
 *
 * Only `auth.not_authenticated` means that. A 403 is a missing role, which no
 * new token would change.
 */
export async function withSession<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
  const token = readToken()
  if (!token) throw sessionEnded()

  try {
    return await call(token)
  } catch (err) {
    if (!(err instanceof AuthError) || err.code !== 'auth.not_authenticated') throw err
  }

  await refreshSession()
  const renewed = readToken()
  if (!renewed) throw sessionEnded()
  return call(renewed)
}

/**
 * End the session here at once, then tell the server.
 *
 * Local first, and never waiting on the network: signing out has to work
 * offline. The server call stops the refresh token being used again; if it is
 * lost, the token still expires on its own.
 */
export function signOut(): void {
  const refreshToken = readRefreshToken()
  clearSession()
  if (refreshToken) revokeRefreshToken(refreshToken).catch(() => {})
}
