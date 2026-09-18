import {
  AuthError,
  clearLocalSession,
  clearSession,
  copySession,
  readRefreshToken,
  readToken,
  refreshTokens,
  revokeRefreshToken,
  storeSession,
} from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { deleteSession, loadSession } from '@/lib/sessionStore'

const REFRESH_LOCK = 'tgs-crm-refresh'

/** Fired on `window` when a renewal finds this tab's session over and clears it. */
export const SESSION_ENDED = 'tgs-crm:session-ended'

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
 * Web Lock. Whoever holds it reads the stored session, not its own copy: if the
 * token there is no longer the one this tab knew, another tab renewed while it
 * waited, and all that's left is to take the new pair.
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

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  // Absent only outside a secure context; there, tabs can still collide.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK, task)
  }
  return task()
}

/** Clear the session everywhere, and let SessionKeeper take this tab to /login. */
async function dropSession(): Promise<void> {
  await clearSession()
  window.dispatchEvent(new Event(SESSION_ENDED))
}

async function renew(seen: string | null): Promise<void> {
  // This tab's own copy moved while it waited: someone renewed or signed out.
  if (readRefreshToken() !== seen) return
  const stored = await loadSession()
  if (!stored) {
    // Signed out in another tab a moment ago: nothing to renew, and nothing to send.
    await dropSession()
    throw sessionEnded()
  }
  if (stored.refresh_token !== seen) {
    copySession(stored)
    return
  }

  await waitForMocking()
  try {
    const tokens = await refreshTokens(stored.refresh_token)
    if (readRefreshToken() !== seen) {
      // Signed out while this was in flight. Storing the new pair would put the
      // user back in a session they ended, so it's revoked instead — left alive
      // it still reads as signed in. And the stored token is spent now: left
      // there, a tab waiting its turn would present it again.
      if ((await loadSession())?.refresh_token === seen) await deleteSession()
      revokeRefreshToken(tokens.refresh_token).catch(() => {})
      return
    }
    await storeSession(tokens)
  } catch (err) {
    // A 401 means the token is spent or revoked, and nothing will renew it. Any
    // other failure — a crash, no connection — may pass, so the session stays.
    if (err instanceof AuthError && err.status === 401) await dropSession()
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
 *
 * The rest waits its turn behind any renewal in flight. Revoked mid-renewal, the
 * token that renewal presents would read to the API as stolen, ending every
 * session the user has.
 */
export function signOut(): void {
  const refreshToken = readRefreshToken()
  clearLocalSession()

  withRefreshLock(async () => {
    const stored = await loadSession()
    await deleteSession()
    // A renewal that finished while this waited may have written its pair back here.
    clearLocalSession()
    for (const token of new Set([refreshToken, stored?.refresh_token])) {
      if (token) revokeRefreshToken(token).catch(() => {})
    }
  }).catch(() => {})
}
